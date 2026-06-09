{
  const BASE_URL = 'http://localhost:3000/api';

  async function testDeepSearch() {
    console.log('🚀 Starting Deep Relational Search Tests...\n');

    try {
      // 1. Setup specific product
      console.log('📦 Creating a unique product: "Super Gadget"...');
      const prodRes = await fetch(`${BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Super Gadget', price: 999, status: 'active' }),
      });
      const product = await prodRes.json();
      const productId = product.data.id;

      // 2. Create customer and order
      console.log('\n👤 Creating customer: "Charlie Searcher"...');
      const charlieRes = await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Charlie Searcher', email: `charlie_${Date.now()}@example.com` }),
      });
      const charlie = await charlieRes.json();
      const customerId = charlie.data.id;

      console.log('🛒 Creating order linked to "Super Gadget"...');
      const orderRes = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, totalAmount: 999, status: 'pending' }),
      });
      const order = await orderRes.json();
      const orderId = order.data.id;

    // Link product to order via pivot
    console.log(`🔗 Linking product ${productId} to order ${orderId}...`);
    const linkRes = await fetch(`${BASE_URL}/order_products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: Number(orderId),
        productId: Number(productId),
        quantity: 1,
        priceAtTime: 999
      }),
    });
    const linkData = await linkRes.json();
    if (!linkData.success) {
      throw new Error(`Failed to link product: ${JSON.stringify(linkData)}`);
    }
    console.log('✅ Linked product to order:', linkData);

    // 2.5 List all order products
    const opsRes = await fetch(`${BASE_URL}/order_products`);
    const opsData = await opsRes.json();
    console.log(`📋 Total order line items: ${opsData.data.length}`);

    // 3. Test Deep Search (Searching Orders by Product Name)
    console.log('\n🔍 DEEP SEARCH: Finding orders containing "Gadget"...');
      const searchRes = await fetch(`${BASE_URL}/orders?q=Gadget`);
      const searchData = await searchRes.json();
      
      if (!searchData.success) {
        throw new Error(`Search failed: ${JSON.stringify(searchData)}`);
      }

      console.log(`✅ Found ${searchData.data.length} orders matching "Gadget"`);
      const match = searchData.data.find((o: any) => o.id === orderId);
      if (match) {
        console.log('✨ Success! Found the correct order via product name search.');
        console.log('📄 Order details:', JSON.stringify(match, null, 2));
      } else {
        console.log('❌ Failed: Could not find the order using product name search.');
        process.exit(1);
      }

      console.log('\n✨ Deep Relational search tests completed successfully!');
    } catch (error) {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    }
  }

  testDeepSearch();
}
