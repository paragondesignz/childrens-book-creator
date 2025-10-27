-- Seed story templates
INSERT INTO public.story_templates (title, description, category, min_age, max_age, page_count, prompt_template, image_style_guide, includes_pets, includes_interests, is_active)
VALUES
  (
    'The Space Adventure',
    'Join an exciting journey through the solar system, discovering planets and meeting friendly aliens',
    'space',
    5,
    10,
    6,
    'Write a 6-page space adventure story where {childName}, a {childAge}-year-old explorer, embarks on a journey through the solar system. The story should include educational facts about planets while maintaining an exciting narrative.',
    'Vibrant space scenes with colorful planets, stars, and friendly alien characters. Style should be bright and engaging, suitable for children aged 5-10.',
    true,
    true,
    true
  ),
  (
    'The Magical Forest',
    'Explore an enchanted forest filled with talking animals and hidden treasures',
    'fantasy',
    3,
    8,
    6,
    'Write a 6-page fantasy story where {childName}, a {childAge}-year-old child, discovers a magical forest near their home. The forest has talking animals, magical creatures, and teaches lessons about friendship and courage.',
    'Whimsical forest scenes with vibrant colors, friendly animals, and magical elements. Watercolor or storybook-classic style preferred.',
    true,
    true,
    true
  ),
  (
    'Ocean Explorer',
    'Dive deep into the ocean to discover marine life and underwater mysteries',
    'adventure',
    4,
    9,
    6,
    'Write a 6-page underwater adventure where {childName}, a {childAge}-year-old marine explorer, discovers the wonders of the ocean. Include educational elements about sea creatures and ocean conservation.',
    'Beautiful underwater scenes with colorful coral reefs, friendly fish, dolphins, and sea turtles. Bright, inviting blue tones.',
    false,
    true,
    true
  ),
  (
    'The Brave Knight',
    'Become a knight on a quest to help the kingdom and learn about bravery',
    'adventure',
    5,
    10,
    6,
    'Write a 6-page medieval adventure where {childName}, a {childAge}-year-old brave knight, goes on a quest to help their kingdom. The story should emphasize courage, kindness, and problem-solving.',
    'Medieval castle scenes with knights, dragons (friendly), and kingdom landscapes. Vibrant colors with a storybook feel.',
    true,
    true,
    true
  ),
  (
    'The Animal Rescue',
    'Help rescue and care for animals while learning about different species',
    'animals',
    3,
    8,
    15,
    'Write a 6-page story where {childName}, a {childAge}-year-old animal lover, helps rescue and care for different animals. Include educational facts about animal care and habitats.',
    'Warm, caring scenes with various animals in need of help. Realistic but child-friendly depictions of animals and natural settings.',
    true,
    true,
    true
  )
ON CONFLICT (title) DO NOTHING;
