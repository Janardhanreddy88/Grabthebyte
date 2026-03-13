import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SearchBarProps { value: string; onChange: (value: string) => void; placeholder?: string; }

export function SearchBar({ value, onChange, placeholder = "Search menu..." }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <motion.div className="relative" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Search className={cn('absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors', isFocused ? 'text-primary' : 'text-muted-foreground')} />
      <Input type="text" value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={cn('pl-10 pr-10 h-11 rounded-xl bg-muted/40 border-transparent text-sm transition-all',
          isFocused && 'border-primary/30 bg-card shadow-sm ring-1 ring-primary/10')} />
      <AnimatePresence>
        {value && (
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/15">
            <X size={13} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
