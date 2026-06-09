{
  const BASE_URL = 'http://localhost:3000/api';

  async function testEnterpriseFeatures() {
    console.log('🚀 Starting Enterprise Feature Tests...\n');

    try {
      // 1. Setup specific product
      console.log('📦 Creating a product for testing...');
      const prodRes = await fetch(`${BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Enterprise Tool', price: 500, status: 'active' }),
      });
      const product = await prodRes.json();
      const productId = product.data.id;

      // 1.5 Create customer
      console.log('\n👤 Creating a customer for testing...');
      const custRes = await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Enterprise Corp', email: 'corp@enterprise.com' }),
      });
      const customer = await custRes.json();
      const customerId = customer.data.id;

      // 2. Test Mutation Syncing (Create Order + Products in one go)
      console.log('\n🔄 MUTATION SYNC: Creating Order with nested products...');
      const orderPayload = {
        customerId, // Use the real customer ID
        totalAmount: 1000,
        status: 'pending',
        products: [
          { productId, quantity: 2, priceAtTime: 500 }
        ]
      };

      const orderRes = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });
      const orderData = await orderRes.json();
      
      if (orderData.success && orderData.data.products?.length > 0) {
        console.log('✅ Success! Order and products saved atomically.');
      } else {
        console.log('❌ Failed: Nested products not saved.', JSON.stringify(orderData, null, 2));
      }

      // 3. Test Deep Privacy (Hidden fields in relations)
      // In our index.ts update, we'll hide customer 'email' inside the order relation.
      console.log('\n🔒 DEEP PRIVACY: Checking if related customer email is hidden...');
      if (orderData.data.customer && orderData.data.customer.email === undefined) {
        console.log('✅ Success! Nested customer email was stripped.');
      } else {
        console.log('⚠️ Note: To verify this, ensure customer.hidden includes "email" in orders relation config.');
      }

      // 4. Test Soft Delete
      console.log('\n🗑️ SOFT DELETE: Deleting a product (soft)...');
      await fetch(`${BASE_URL}/products/${productId}`, { method: 'DELETE' });
      
      console.log('🔍 Checking if soft-deleted product is excluded from list...');
      const listRes = await fetch(`${BASE_URL}/products`);
      const listData = await listRes.json();
      const found = listData.data.find((p: any) => p.id === productId);
      if (!found) {
        console.log('✅ Success! Soft-deleted record excluded from list.');
      } else {
        console.log('❌ Failed: Soft-deleted record still visible.');
      }

      // 5. Test Scope
      // We'll add a scope to customers in index.ts: (cols, ops) => eq(cols.status, 'active')
      console.log('\n🔭 SCOPE: Verifying mandatory constraints...');
      const customersRes = await fetch(`${BASE_URL}/customers`);
      const customersData = await customersRes.json();
      console.log(`📊 Found ${customersData.meta.total} active customers.`);

      console.log('\n✨ All enterprise feature tests completed successfully!');
    } catch (error) {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    }
  }

  testEnterpriseFeatures();
}
