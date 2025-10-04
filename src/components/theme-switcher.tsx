'use client';

import { Moon, Sun, Monitor, Palette } from 'lucide-react';
import { useTheme } from '@/contexts/theme-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export function ThemeSwitcher() {
  const { theme, colorTheme, setTheme, setColorTheme, resolvedTheme } = useTheme();

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun, description: 'Always use light mode' },
    { value: 'dark', label: 'Dark', icon: Moon, description: 'Always use dark mode' },
    { value: 'auto', label: 'Auto', icon: Monitor, description: 'Match system settings' },
  ] as const;

  const colorOptions = [
    {
      value: 'yellow',
      label: 'Yellow',
      preview: 'bg-[hsl(45,95%,55%)]',
      description: 'Default yellow accent'
    },
    {
      value: 'pink',
      label: 'Hot Pink',
      preview: 'bg-[hsl(330,100%,60%)]',
      description: 'Vibrant hot pink accent'
    },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Theme Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {resolvedTheme === 'dark' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
            Theme Mode
          </CardTitle>
          <CardDescription>Choose your preferred theme mode</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={theme} onValueChange={(value) => setTheme(value as any)}>
            <div className="space-y-3">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.value}
                    className={cn(
                      'flex items-center space-x-3 rounded-lg border p-4 transition-colors cursor-pointer hover:bg-accent/50',
                      theme === option.value && 'border-primary bg-accent/30'
                    )}
                    onClick={() => setTheme(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={option.value} />
                    <div className="flex items-center gap-3 flex-1">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === option.value ? 'bg-primary/10' : 'bg-muted'
                      )}>
                        <Icon className={cn(
                          'h-5 w-5',
                          theme === option.value && 'text-primary'
                        )} />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor={option.value} className="font-medium cursor-pointer">
                          {option.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Color Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Color Theme
          </CardTitle>
          <CardDescription>Choose your accent color</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={colorTheme} onValueChange={(value) => setColorTheme(value as any)}>
            <div className="space-y-3">
              {colorOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    'flex items-center space-x-3 rounded-lg border p-4 transition-colors cursor-pointer hover:bg-accent/50',
                    colorTheme === option.value && 'border-primary bg-accent/30'
                  )}
                  onClick={() => setColorTheme(option.value)}
                >
                  <RadioGroupItem value={option.value} id={`color-${option.value}`} />
                  <div className="flex items-center gap-3 flex-1">
                    <div className={cn(
                      'w-10 h-10 rounded-full border-2 border-white shadow-sm',
                      option.preview
                    )} />
                    <div className="flex-1">
                      <Label htmlFor={`color-${option.value}`} className="font-medium cursor-pointer">
                        {option.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>See how your choices look</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button>Primary Button</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
          </div>
          <div className="p-4 rounded-lg bg-accent text-accent-foreground">
            <p className="font-semibold">Accent Color Preview</p>
            <p className="text-sm">This is how the accent color looks in your theme</p>
          </div>
          <div className="flex gap-2">
            <div className="h-12 w-12 rounded bg-primary" />
            <div className="h-12 w-12 rounded bg-secondary" />
            <div className="h-12 w-12 rounded bg-muted" />
            <div className="h-12 w-12 rounded bg-accent" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
