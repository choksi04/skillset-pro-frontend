import { RatingLevel } from '@/stores/registryStore';
import { useCompetencyLevelStore, getRatingLabels, getRatingDescriptions } from '@/stores/competencyLevelStore';

interface RatingSliderProps {
  value: RatingLevel | null;
  onChange: (value: RatingLevel | null) => void;
  disabled?: boolean;
  previousRating?: RatingLevel;
  variant?: 'compact' | 'card';
  allowUnselect?: boolean;
}

const levelNums: RatingLevel[] = [1, 2, 3, 4, 5];

export default function RatingSlider({
  value,
  onChange,
  disabled,
  previousRating,
  variant = 'compact',
  allowUnselect = false,
}: RatingSliderProps) {
  const { levels } = useCompetencyLevelStore();
  const labels = getRatingLabels(levels);
  const descriptions = getRatingDescriptions(levels);

  const handleClick = (level: RatingLevel) => {
    if (disabled) return;
    if (allowUnselect && value === level) {
      onChange(null as unknown as RatingLevel);
    } else {
      onChange(level);
    }
  };

  if (variant === 'card') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-5 gap-2">
          {levelNums.map((level) => {
            const selected = value === level;
            return (
              <button
                key={level}
                type="button"
                disabled={disabled}
                onClick={() => handleClick(level)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border py-2.5 px-1 transition-all ${
                  selected
                    ? 'bg-primary/10 border-primary text-primary shadow-sm'
                    : 'bg-card border-border text-foreground hover:border-primary/40 hover:bg-muted/40'
                } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <span className={`text-base font-semibold leading-none ${selected ? 'text-primary' : 'text-foreground'}`}>
                  {level}
                </span>
                <span className={`text-[9px] font-medium uppercase tracking-wider leading-none truncate max-w-full ${
                  selected ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {labels[level] ?? `L${level}`}
                </span>
              </button>
            );
          })}
        </div>
        {(value || previousRating) && (
          <div className="rounded-md bg-muted/40 px-3 py-2">
            {value && (
              <p className="text-[11px] text-muted-foreground leading-snug">
                <span className="font-medium text-foreground">Level {value} — {labels[value] ?? `Level ${value}`}.</span>{' '}
                {descriptions[value] ?? ''}
              </p>
            )}
            {previousRating && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Last cycle: <span className="font-medium text-foreground">L{previousRating} — {labels[previousRating] ?? `Level ${previousRating}`}</span>
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {levelNums.map((level) => (
          <button
            key={level}
            disabled={disabled}
            onClick={() => handleClick(level)}
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
              <p className="text-xs font-medium text-foreground">Level {value} — {labels[value] ?? `Level ${value}`}</p>
              <p className="text-[11px] text-muted-foreground">{descriptions[value] ?? ''}</p>
            </>
          )}
          {previousRating && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Last cycle: <span className="font-medium text-foreground">L{previousRating} — {labels[previousRating] ?? `Level ${previousRating}`}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
