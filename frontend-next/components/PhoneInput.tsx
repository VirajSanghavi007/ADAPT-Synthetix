"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { COUNTRIES, DEFAULT_COUNTRY, flagEmoji, type Country } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type PhoneInputProps = {
  value: string; 
  onValueChange: (value: string) => void;
  country: Country;
  onCountryChange: (country: Country) => void;
  id?: string;
};

export default function PhoneInput({ value, onValueChange, country, onCountryChange, id }: PhoneInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" className="w-28 shrink-0 justify-between cursor-pointer" />}
        >
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true">{flagEmoji(country.iso)}</span>
            <span className="text-sm">{country.dial}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Search country..." />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((c) => (
                  <CommandItem
                    key={c.iso}
                    value={`${c.name} ${c.dial}`}
                    onSelect={() => {
                      onCountryChange(c);
                      setOpen(false);
                    }}
                    className={cn("cursor-pointer", c.iso === country.iso && "bg-secondary")}
                  >
                    <span className="mr-2" aria-hidden="true">{flagEmoji(c.iso)}</span>
                    <span className="flex-1">{c.name}</span>
                    <span className="text-muted">{c.dial}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        id={id}
        type="tel"
        autoComplete="tel-national"
        value={value}
        onChange={(e) => onValueChange(e.target.value.replace(/[^\d\s-]/g, ""))}
        placeholder="90000 00000"
        className="flex-1"
      />
    </div>
  );
}
