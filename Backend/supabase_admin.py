import os

from supabase import Client, create_client

_client: Client | None = None


def get_admin_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
    return _client


def update_user_password(user_id: str, new_password: str):
    client = get_admin_client()
    client.auth.admin.update_user_by_id(user_id, {"password": new_password})
