const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const item = await prisma.itemMapping.create({
    data: {
      name: '球粒隕石圓頭錘',
      itemId: 123456,
      locale: 'zh-TW'
    }
  });

  const recipe = await prisma.recipe.create({
    data: {
      targetId: item.id,
      yieldAmount: 1,
      items: {
        create: [
          { name: '球粒隕石錠', quantity: 3, isHQ: false },
          { name: '完滿木木材', quantity: 1, isHQ: false },
          { name: '潛能量碎晶', quantity: 1, isHQ: false },
          { name: '火之水晶', quantity: 8, isHQ: false },
          { name: '土之水晶', quantity: 8, isHQ: false }
        ]
      }
    }
  });

  await prisma.priceTrend.createMany({
    data: [
      { itemId: 123456, world: '鳳凰', isHQ: false, unitPrice: 50000 },
      { itemId: 123456, world: '鳳凰', isHQ: false, unitPrice: 52000 },
      { itemId: 123456, world: '鳳凰', isHQ: false, unitPrice: 51000 }
    ]
  });

  console.log('Seed data created:', { itemId: item.id, recipeId: recipe.id });
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
