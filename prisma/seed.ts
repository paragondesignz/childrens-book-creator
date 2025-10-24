import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create story templates
  const templates = [
    {
      title: 'The Space Adventure',
      description: 'Join an exciting journey through the solar system, discovering planets and meeting friendly aliens',
      category: 'space',
      minAge: 5,
      maxAge: 10,
      pageCount: 15,
      promptTemplate: `Write a 15-page space adventure story where {childName}, a {childAge}-year-old explorer, embarks on a journey through the solar system. The story should include educational facts about planets while maintaining an exciting narrative.`,
      imageStyleGuide: 'Vibrant space scenes with colorful planets, stars, and friendly alien characters. Style should be bright and engaging, suitable for children aged 5-10.',
      includesPets: true,
      includesInterests: true,
      isActive: true,
    },
    {
      title: 'The Magical Forest',
      description: 'Explore an enchanted forest filled with talking animals and hidden treasures',
      category: 'fantasy',
      minAge: 3,
      maxAge: 8,
      pageCount: 15,
      promptTemplate: `Write a 15-page fantasy story where {childName}, a {childAge}-year-old child, discovers a magical forest near their home. The forest has talking animals, magical creatures, and teaches lessons about friendship and courage.`,
      imageStyleGuide: 'Whimsical forest scenes with vibrant colors, friendly animals, and magical elements. Watercolor or storybook-classic style preferred.',
      includesPets: true,
      includesInterests: true,
      isActive: true,
    },
    {
      title: 'Ocean Explorer',
      description: 'Dive deep into the ocean to discover marine life and underwater mysteries',
      category: 'adventure',
      minAge: 4,
      maxAge: 9,
      pageCount: 15,
      promptTemplate: `Write a 15-page underwater adventure where {childName}, a {childAge}-year-old marine explorer, discovers the wonders of the ocean. Include educational elements about sea creatures and ocean conservation.`,
      imageStyleGuide: 'Beautiful underwater scenes with colorful coral reefs, friendly fish, dolphins, and sea turtles. Bright, inviting blue tones.',
      includesPets: false,
      includesInterests: true,
      isActive: true,
    },
    {
      title: 'The Brave Knight',
      description: 'Become a knight on a quest to help the kingdom and learn about bravery',
      category: 'adventure',
      minAge: 5,
      maxAge: 10,
      pageCount: 15,
      promptTemplate: `Write a 15-page medieval adventure where {childName}, a {childAge}-year-old brave knight, goes on a quest to help their kingdom. The story should emphasize courage, kindness, and problem-solving.`,
      imageStyleGuide: 'Medieval castle scenes with knights, dragons (friendly), and kingdom landscapes. Vibrant colors with a storybook feel.',
      includesPets: true,
      includesInterests: true,
      isActive: true,
    },
    {
      title: 'The Animal Rescue',
      description: 'Help rescue and care for animals while learning about different species',
      category: 'animals',
      minAge: 3,
      maxAge: 8,
      pageCount: 15,
      promptTemplate: `Write a 15-page story where {childName}, a {childAge}-year-old animal lover, helps rescue and care for different animals. Include educational facts about animal care and habitats.`,
      imageStyleGuide: 'Warm, caring scenes with various animals in need of help. Realistic but child-friendly depictions of animals and natural settings.',
      includesPets: true,
      includesInterests: true,
      isActive: true,
    },
  ];

  for (const template of templates) {
    await prisma.storyTemplate.upsert({
      where: { title: template.title },
      update: template,
      create: template,
    });
    console.log(`Created template: ${template.title}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
