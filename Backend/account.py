import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import text as sql_text

from Backend.db import ASRLog, AccountDeletionRequest, PhonemeError, TTSLog, get_session, utcnow
from Backend.email_utils import send_email
from Backend.jwks import require_user
from Backend.supabase_admin import get_admin_client
from Backend.tiers import get_user_tier

router = APIRouter(prefix="/api/account", tags=["account"])

FRONTEND_URL = os.environ.get("ORIGIN", "http://localhost:3000")
DELETION_DELAY_HOURS = 24
CRON_SECRET = os.environ.get("CRON_SECRET")


@router.get("/usage")
def get_usage(user: dict = Depends(require_user)):
    db = get_session()
    try:
        asr_rows = db.query(ASRLog.transcript, ASRLog.duration_sec).filter(ASRLog.user_id == user["id"]).all()
        tts_rows = db.query(TTSLog.input_text).filter(TTSLog.user_id == user["id"]).all()
    finally:
        db.close()

    asr_words = sum(len(t.split()) for t, _ in asr_rows if t)
    tts_words = sum(len(t.split()) for (t,) in tts_rows if t)
    audio_seconds = sum(d for _, d in asr_rows if d)

    return {
        "asr_word_count": asr_words,
        "tts_word_count": tts_words,
        "total_word_count": asr_words + tts_words,
        "audio_hours": round(audio_seconds / 3600, 2),
        "transcription_count": len(asr_rows),
        "synthesis_count": len(tts_rows),
    }


@router.post("/delete/request")
def request_deletion(user: dict = Depends(require_user)):
    tier = get_user_tier(user["id"])
    if tier not in ("free", "enterprise"):
        raise HTTPException(
            400,
            f"cancel your {tier} subscription from the Subscription page before deleting your account",
        )

    token = secrets.token_urlsafe(32)
    db = get_session()
    try:
        db.add(AccountDeletionRequest(user_id=user["id"], token=token))
        db.commit()
    finally:
        db.close()

    confirm_link = f"{FRONTEND_URL}/confirm-delete?token={token}"
    sent = send_email(
        to=user["email"],
        subject="Confirm account deletion — ADAPT-Synthetix",
        body=(
            "We received a request to permanently delete your ADAPT-Synthetix account.\n\n"
            f"Confirm here: {confirm_link}\n\n"
            f"Confirming schedules deletion {DELETION_DELAY_HOURS} hours out — this gives you a "
            "last window to change your mind. After that, deletion is permanent and cannot be undone.\n\n"
            "If you didn't request this, ignore this email."
        ),
    )

    response = {"status": "verification_sent" if sent else "smtp_not_configured"}
    if not sent:
        response["dev_confirm_link"] = confirm_link
    return response


@router.post("/delete/confirm")
def confirm_deletion(token: str):
    db = get_session()
    try:
        req = (
            db.query(AccountDeletionRequest)
            .filter(AccountDeletionRequest.token == token, AccountDeletionRequest.confirmed == 0)
            .first()
        )
        if req is None:
            raise HTTPException(404, "invalid or already-used deletion link")

        req.confirmed = 1
        req.confirmed_at = utcnow()
        db.commit()
    finally:
        db.close()

    return {"status": "scheduled", "delay_hours": DELETION_DELAY_HOURS}


@router.post("/delete/execute-pending")
def execute_pending_deletions(x_cron_secret: str | None = Header(None)):
    if not CRON_SECRET or x_cron_secret != CRON_SECRET:
        raise HTTPException(403, "invalid or missing cron secret")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=DELETION_DELAY_HOURS)
    db = get_session()
    try:
        due = (
            db.query(AccountDeletionRequest)
            .filter(
                AccountDeletionRequest.confirmed == 1,
                AccountDeletionRequest.executed == 0,
                AccountDeletionRequest.confirmed_at <= cutoff,
            )
            .all()
        )
        user_ids = [req.user_id for req in due]
        for req in due:
            req.executed = 1
        db.commit()
    finally:
        db.close()

    deleted = []
    for user_id in user_ids:
        purge_db = get_session()
        try:
            transcription_ids = [
                row[0] for row in purge_db.query(ASRLog.id).filter(ASRLog.user_id == user_id).all()
            ]
            if transcription_ids:
                purge_db.query(PhonemeError).filter(
                    PhonemeError.transcription_id.in_(transcription_ids)
                ).delete(synchronize_session=False)
            purge_db.query(ASRLog).filter(ASRLog.user_id == user_id).delete(synchronize_session=False)
            purge_db.query(TTSLog).filter(TTSLog.user_id == user_id).delete(synchronize_session=False)
            purge_db.execute(sql_text("delete from api_keys where user_id = :uid"), {"uid": user_id})
            purge_db.commit()
        finally:
            purge_db.close()

        try:
            get_admin_client().auth.admin.delete_user(user_id)
            deleted.append(user_id)
        except Exception as e:
            print(f"failed to delete user {user_id}: {e}")

    return {"deleted_count": len(deleted)}
