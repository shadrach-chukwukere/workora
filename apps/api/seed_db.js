import('./src/database/connection.js').then(m => {
  return import('./src/database/seeds/seed.js').then(s => {
    const instance = m.db();
    s.seed(instance).then(() => {
      console.log('seed done');
      process.exit(0);
    }).catch(e => {
      console.error(e);
      process.exit(1);
    });
  });
}).catch(e => {
  console.error(e);
  process.exit(1);
});