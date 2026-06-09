const BASE_URL = 'http://localhost:3000/api';

async function testApi() {
  console.log('🚀 Starting Relational API Tests...\n');

  try {
    // 1. Setup Data
    console.log('📦 Ensuring products exist...');
    const prodRes = await fetch(`${BASE_URL}/products`);
    const prodData = await prodRes.json();
    let productId: number;

    if (prodData.data.length === 0) {
      const createProd = await fetch(`${BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Default Product', price: 100, status: 'active' }),
      });
      const newProd = await createProd.json();
      productId = newProd.data.id;
    } else {
      productId = prodData.data[0].id;
    }

    // 2. Create a specific customer for searching
    console.log('\n👤 Creating a specific customer: "Bob Relational"...');
    const bobRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Relational',
        email: `bob_${Date.now()}@example.com`,
      }),
    });
    const bob = await bobRes.json();
    const bobId = bob.data.id;

    console.log('🛒 Creating an order for Bob...');
    await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: bobId,
        totalAmount: 550,
        status: 'pending'
      }),
    });

    // 3. Test Global Search across Relations
    console.log('\n🔍 SEARCH: Finding orders where customer name contains "Bob"...');
    const searchRes = await fetch(`${BASE_URL}/orders?q=Bob`);
    const searchData = await searchRes.json();
    console.log(`✅ Found ${searchData.data.length} orders matching "Bob"`);
    if (searchData.data.length > 0) {
      console.log('📄 Sample Result (joined data):', JSON.stringify(searchData.data[0].customer, null, 2));
    }

    // 4. Test Double Underscore Filtering (Date & Range)
    console.log('\n📉 FILTER: Finding expensive orders (totalAmount__gte=500)...');
    const filterRes = await fetch(`${BASE_URL}/orders?totalAmount__gte=500`);
    const filterData = await filterRes.json();
    console.log(`✅ Found ${filterData.data.length} expensive orders`);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log(`\n📅 DATE FILTER: Finding customers created since yesterday (createdAt__gte=${yesterday})...`);
    const dateRes = await fetch(`${BASE_URL}/customers?createdAt__gte=${yesterday}`);
    const dateData = await dateRes.json();
    console.log(`✅ Found ${dateData.meta.total} recent customers`);

    console.log('\n✨ Relational tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testApi();
