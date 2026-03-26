import { RatingLevel, ratingLabels, ratingDescriptions } from '@/stores/registryStore';

interface RatingSliderProps {
  value: RatingLevel | null;
  onChange: (value: RatingLevel) => void;
  disabled?: boolean;
  previousRating?: RatingLevel;
}

const levels: RatingLevel[] = [1, 2, 3, 4, 5];

export default function RatingSlider({ value, onChange, disabled, previousRating }: RatingSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {levels.map((level) => (
          <button
            key={level}
            disabled={disabled}
            onClick={() => onChange(level)}
            className={`flex-1 h-9 rounded-md text-xs font-medium transition-all border ${
              value === level
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : value && level <= value
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
            } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            L{level}
          </button>
        ))}
      </div>
      {(value || previousRating) && (
        <div className="rounded-md bg-muted/50 px-3 py-1.5">
          {value && (
            <>
              <p className="text-xs font-medium text-foreground">Level {value} — {ratingLabels[value]}</p>
              <p className="text-[11px] text-muted-foreground">{ratingDescriptions[value]}</p>
            </>
          )}
          {previousRating && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Last cycle: <span className="font-medium text-foreground">L{previousRating} — {ratingLabels[previousRating]}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
