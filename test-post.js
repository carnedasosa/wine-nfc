

async function testPost() {
  try {
    const res = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Test Local', email: 'testlocal@example.com' })
    });
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('BODY:', text);
  } catch (e) {
    console.error('ERROR:', e);
  }
}
testPost();
