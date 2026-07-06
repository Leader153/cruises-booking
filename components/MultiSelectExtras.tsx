
import React, { useEffect } from 'react';
import { Check } from 'lucide-react';
import { ExtraOption, YachtDatabase } from '../types'; // Import YachtDatabase
import { EXTRAS_MAP, EXTRAS_PRICES } from '../constants';

interface MultiSelectExtrasProps {
  selectedExtras: ExtraOption[];
  onSelectionChange: (selected: ExtraOption[]) => void;
  selectedYachtName: string; 
  yachtsDb: YachtDatabase | null; // Pass yachtsDb to MultiSelectExtras
}

const MultiSelectExtras: React.FC<MultiSelectExtrasProps> = ({
  selectedExtras,
  onSelectionChange,
  selectedYachtName,
  yachtsDb,
}) => {
  const allExtraOptions: ExtraOption[] = (Object.keys(EXTRAS_MAP) as ExtraOption[])
    .filter(option => option !== 'none');

  // Effect to deselect 'fishing' if yacht changes and it's no longer 'לי-ים'
  useEffect(() => {
    const trimmedYachtName = selectedYachtName.trim();
    if (selectedExtras.includes('fishing') && yachtsDb && trimmedYachtName) {
      const yachtInfo = yachtsDb[trimmedYachtName];
      if (yachtInfo && yachtInfo.city !== 'Herzliya') { // Assuming fishing is only for Herzliya
        onSelectionChange(selectedExtras.filter(item => item !== 'fishing'));
      }
    }
  }, [selectedYachtName, selectedExtras, onSelectionChange, yachtsDb]);


  const handleOptionClick = (option: ExtraOption) => {
    const trimmedYachtName = selectedYachtName.trim();
    const isFishingOption = option === 'fishing';
    const isYachtInHerzliya = yachtsDb && trimmedYachtName && yachtsDb[trimmedYachtName]?.city === 'Herzliya';

    // Prevent interaction if the option is disabled (e.g., fishing for non-Herzliya yachts)
    if (isFishingOption && !isYachtInHerzliya) {
      return;
    }

    let updatedSelection: ExtraOption[];

    if (option === 'none') {
      // If 'none' is selected, clear other selections. If it's deselected, make sure other valid options are maintained if any.
      updatedSelection = selectedExtras.includes('none') ? 
                         [] : 
                         ['none'];
    } else { // User clicked a specific extra option (not 'none')
      if (selectedExtras.includes(option)) {
        // If this option was selected, clicking it deselects it.
        updatedSelection = selectedExtras.filter(item => item !== option);
      } else {
        // If this option was not selected, add it. Ensure 'none' is removed if it was present.
        updatedSelection = [...selectedExtras.filter(item => item !== 'none'), option];
      }
    }

    // After any click, if the selection becomes empty, default to ['none'].
    // This ensures that either specific extras are chosen, or 'none' is.
    if (updatedSelection.length === 0) {
      updatedSelection = ['none'];
    }

    onSelectionChange(updatedSelection);
  };

  return (
    <div 
      className="w-full bg-slate-50 border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 outline-none transition-all"
      role="listbox" // ARIA for accessibility
      aria-multiselectable="true"
    >
      <div className="max-h-28 overflow-y-auto">
        {/* Render 'none' option first */}
        <div
          key="none"
          className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-slate-100 transition-colors text-sm ${
            (selectedExtras.includes('none') || selectedExtras.length === 0) ? 'font-medium text-blue-700' : 'text-slate-700'
          }`}
          onClick={() => handleOptionClick('none')}
          role="option"
          aria-selected={selectedExtras.includes('none') || selectedExtras.length === 0}
          tabIndex={0} // Make selectable with keyboard
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOptionClick('none');
            }
          }}
        >
          {(selectedExtras.includes('none') || selectedExtras.length === 0) ? (
            <Check size={16} className="text-blue-600 flex-shrink-0" />
          ) : (
            <div className="w-4 h-4 flex-shrink-0"></div>
          )}
          <span>
            {EXTRAS_MAP['none']} ({EXTRAS_PRICES['none']} ₪)
          </span>
        </div>

        {allExtraOptions.map((option) => {
          const isFishingOption = option === 'fishing';
          const trimmedYachtName = selectedYachtName.trim();
          const isYachtInHerzliya = yachtsDb && trimmedYachtName && yachtsDb[trimmedYachtName]?.city === 'Herzliya';
          const isOptionDisabled = isFishingOption && !isYachtInHerzliya;
          
          // Determine the display name for the extra option
          const displayName = (isFishingOption && isYachtInHerzliya) 
                                ? 'דייג בהרצליה' 
                                : EXTRAS_MAP[option];

          // An option is selected if it's in the array AND 'none' is not selected.
          // This makes 'none' mutually exclusive with other options in terms of *effective* selection.
          const isSelected = selectedExtras.includes(option) && !selectedExtras.includes('none');

          return (
            <div
              key={option}
              className={`flex items-center gap-2 px-4 py-2 transition-colors text-sm 
                ${isOptionDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100'}
                ${isSelected && !isOptionDisabled ? 'font-medium text-blue-700' : 'text-slate-700'}
              `}
              onClick={() => handleOptionClick(option)}
              role="option"
              aria-selected={isSelected}
              aria-disabled={isOptionDisabled}
              tabIndex={isOptionDisabled ? -1 : 0} // Disable keyboard navigation if option is disabled
              onKeyDown={(e) => {
                if (!isOptionDisabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleOptionClick(option);
                }
              }}
            >
              {isSelected && !isOptionDisabled ? (
                <Check size={16} className="text-blue-600 flex-shrink-0" />
              ) : (
                <div className="w-4 h-4 flex-shrink-0"></div>
              )}
              <span>
                {displayName} ({EXTRAS_PRICES[option]} ₪)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MultiSelectExtras;