import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";

export function PreferencesControls() {
  return (
    <div className="flex items-center gap-2">
      <LanguageToggle />
      <ThemeToggle />
    </div>
  );
}
