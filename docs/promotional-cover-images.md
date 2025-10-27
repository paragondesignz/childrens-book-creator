# Promotional Cover Images Library

This document describes the promotional cover images used throughout the app for marketing and template selection purposes.

## Overview

Promotional cover images are pre-generated, high-quality cover illustrations for each story template. These are used:
- On the landing page to showcase examples
- On the template selection page to help users visualize each story theme
- In marketing materials

## Storage Location

All promotional covers are stored in `/public/covers/` with standardized naming:

```
/public/covers/
  space-adventure.jpg
  magical-forest.jpg
  ocean-explorer.jpg
  ...etc
```

## Naming Convention

Convert template title to lowercase kebab-case:
- "The Space Adventure" → `space-adventure.jpg`
- "Chef's Kitchen" → `chefs-kitchen.jpg`
- "Inventor's Workshop" → `inventors-workshop.jpg`

## Image Specifications

- **Format:** JPG (for file size optimization)
- **Dimensions:** 1024x1024 pixels (square format matching our book format)
- **Quality:** 85% compression for web
- **Style:** Representative of the story theme with generic characters (not personalized)
- **Text:** Include story title prominently on cover

## Complete Template List (35 Templates)

### Adventure & Exploration
1. space-adventure.jpg - "The Space Adventure"
2. ocean-explorer.jpg - "Ocean Explorer"
3. jungle-explorer.jpg - "Jungle Explorer"
4. lost-city.jpg - "The Lost City"
5. island-castaway.jpg - "Island Castaway"
6. arctic-expedition.jpg - "Arctic Expedition"
7. mountain-climber.jpg - "Mountain Climber"
8. submarine-voyage.jpg - "Submarine Voyage"

### Fantasy & Magic
9. magical-forest.jpg - "The Magical Forest"
10. brave-knight.jpg - "The Brave Knight"
11. time-traveler.jpg - "The Time Traveler"
12. superhero-origin.jpg - "Superhero Origin"
13. weather-wizard.jpg - "Weather Wizard"
14. monster-friends.jpg - "Monster Friends"
15. fairy-garden.jpg - "Fairy Garden"
16. royal-castle-adventure.jpg - "Royal Castle Adventure"
17. wizard-school.jpg - "Wizard School"

### Science & Technology
18. robot-friend.jpg - "Robot Friend"
19. space-station.jpg - "Space Station"
20. inventors-workshop.jpg - "Inventor's Workshop"

### Animals & Nature
21. animal-rescue.jpg - "The Animal Rescue"
22. farm-friends.jpg - "Farm Friends"
23. dinosaur-discovery.jpg - "Dinosaur Discovery"
24. veterinarian-hero.jpg - "Veterinarian Hero"

### Arts & Performance
25. music-star.jpg - "Music Star"
26. art-adventure.jpg - "Art Adventure"
27. ballet-dreams.jpg - "Ballet Dreams"
28. circus-adventure.jpg - "Circus Adventure"

### Sports & Activities
29. sports-champion.jpg - "Sports Champion"
30. race-car-driver.jpg - "Race Car Driver"
31. gymnastics-star.jpg - "Gymnastics Star"

### Mysteries & Detectives
32. mystery-detective.jpg - "Mystery Detective"
33. pirate-treasure-hunt.jpg - "Pirate Treasure Hunt"

### Everyday Adventures
34. chefs-kitchen.jpg - "Chef's Kitchen"
35. train-conductor.jpg - "Train Conductor"

## How to Generate Covers

### Option 1: Use Existing Generated Covers
When a book is completed with high-quality results, save the front cover as a promotional template:

1. Find a completed book with the desired template
2. Download the front cover image from Supabase storage
3. Rename to match convention (e.g., `space-adventure.jpg`)
4. Optimize for web (resize to 1024x1024, compress to 85% quality)
5. Place in `/public/covers/`

### Option 2: Generate New Covers with Gemini
Use the image generation service to create promotional covers:

```bash
npm run generate:covers
```

This script will:
1. Generate a cover for each template that doesn't have one yet
2. Use generic characters (not personalized)
3. Include the story title prominently
4. Save to `/public/covers/`

### Option 3: Manual Creation
For highest quality, create covers manually:
- Use Figma, Photoshop, or similar
- Follow brand guidelines
- Include story title
- Export at 1024x1024

## Usage in Code

### Landing Page
```tsx
import Image from 'next/image';

<div className="grid grid-cols-3 gap-4">
  <Image src="/covers/space-adventure.jpg" alt="The Space Adventure" width={300} height={300} />
  <Image src="/covers/magical-forest.jpg" alt="The Magical Forest" width={300} height={300} />
  <Image src="/covers/ocean-explorer.jpg" alt="Ocean Explorer" width={300} height={300} />
</div>
```

### Template Selection Page
```tsx
{templates.map((template) => {
  const coverImage = `/covers/${template.title.toLowerCase().replace(/['\s]/g, '-').replace(/--/g, '-')}.jpg`;

  return (
    <div key={template.id}>
      <Image src={coverImage} alt={template.title} width={400} height={400} />
      <h3>{template.title}</h3>
    </div>
  );
})}
```

## Placeholder Images

Until promotional covers are generated, use a placeholder:

```tsx
const coverImage = `/covers/${slugify(template.title)}.jpg`;
const fallbackImage = '/covers/placeholder.jpg';

<Image
  src={coverImage}
  alt={template.title}
  width={400}
  height={400}
  onError={(e) => { e.currentTarget.src = fallbackImage; }}
/>
```

## Priority Order for Generation

Generate covers in this order based on popularity/marketing importance:

**Phase 1 (High Priority - 10 covers):**
1. The Space Adventure
2. The Magical Forest
3. Ocean Explorer
4. Superhero Origin
5. Pirate Treasure Hunt
6. Dinosaur Discovery
7. Robot Friend
8. Mystery Detective
9. Fairy Garden
10. Sports Champion

**Phase 2 (Medium Priority - 15 covers):**
11-25. Remaining popular themes

**Phase 3 (Lower Priority - 10 covers):**
26-35. Specialized/niche themes

## Maintenance

- Review covers quarterly for quality
- Update covers if branding changes
- Add new covers when new templates are added
- Remove covers for deprecated templates

---

*Last Updated: 2025-10-27*
