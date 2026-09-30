import re

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Palette replacement
old_palette = '''  /* Palette "Cantina Notturna" - Calda e organica */
  --bg: #110e0d;
  --bg2: #1a1514;
  --bg3: #241e1c;
  --border: rgba(255, 255, 255, 0.08);
  --border-light: rgba(255, 255, 255, 0.14);
  --text: #f0ece4;
  --text-muted: rgba(240, 236, 228, 0.65); /* Aumentato per visibilità solare */
  --text-dim: rgba(240, 236, 228, 0.35);
  --gold: #c9a84c;
  --gold-soft: rgba(201, 168, 76, 0.15);
  --gold-dim: rgba(201, 168, 76, 0.08);
  --red-wine: #7a1f2e;'''

new_palette = '''  /* Palette "Sovranaturale Pop" - Vibrante e Giocosa */
  --bg: #FFFBEB; /* Panna/Giallo chiaro */
  --bg2: #FEF3C7;
  --bg3: #FDE68A;
  --border: rgba(30, 27, 75, 0.15);
  --border-light: rgba(30, 27, 75, 0.08);
  --text: #1E1B4B; /* Blu scuro scuro */
  --text-muted: rgba(30, 27, 75, 0.7); 
  --text-dim: rgba(30, 27, 75, 0.4);
  --gold: #EA580C; /* Arancio vibrante (sostituisce l'oro) */
  --gold-soft: rgba(234, 88, 12, 0.15);
  --gold-dim: rgba(234, 88, 12, 0.08);
  --red-wine: #6D28D9; /* Viola vibrante */
  --green: #22C55E; /* Verde Sovranaturale */'''

css = css.replace(old_palette, new_palette)

# Font replacements
css = css.replace(\"font-family: 'Outfit', sans-serif;\", \"font-family: 'Fredoka', sans-serif;\")
css = css.replace(\"font-family: 'Inter', sans-serif;\", \"font-family: 'Fredoka', sans-serif;\")
css = css.replace(\"font-family: 'Cormorant Garamond', serif;\", \"font-family: 'Luckiest Guy', display; letter-spacing: 0.05em;\")
css = css.replace(\"font-family: 'DM Sans', 'Inter', sans-serif;\", \"font-family: 'Fredoka', sans-serif;\")

# We should also replace font-style: italic; where Luckiest Guy is used, since it doesn't have italic
css = css.replace(\"font-style: italic;\", \"/* font-style: italic; */\")

# Let's fix the onboarding-title font specifically to Caveat for the "Passaporto" text
css = css.replace(\".onboarding-title em { font-style: italic; color: var(--gold); }\", \".onboarding-title em { font-family: 'Caveat', cursive; font-size: 1.3em; font-style: normal; color: var(--red-wine); display: block; transform: rotate(-5deg); margin: 10px 0; }\")
css = css.replace(\".wine-card-score {\", \".wine-card-score { font-family: 'Caveat', cursive; font-size: 28px;\")

# Adjust text colors for light mode readability (some places hardcoded dark bg)
css = css.replace(\"background: rgba(13,13,13,0.95);\", \"background: rgba(255,251,235,0.95);\")
css = css.replace(\"color: #0d0d0d;\", \"color: #FFFBEB;\")
css = css.replace(\"background: rgba(17, 14, 13, 0.65);\", \"background: rgba(255,251,235,0.85);\")

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('Updated style.css')
