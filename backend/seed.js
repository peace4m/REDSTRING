const mongoose = require('mongoose');
const seedData = require('./schema/seed_case_midnight_conductor.js');
const CaseFile = require('./schema/caseFile.schema.js');

// Clean connection string targeting the branded database
mongoose.connect('mongodb://127.0.0.1:27017/redstring')
    .then(() => {
        console.log('Connected to MongoDB... Seeding database now.');
        return CaseFile.deleteMany({ caseId: seedData.caseId });
    })
    .then(() => {
        return CaseFile.create(seedData);
    })
    .then(() => {
        console.log('Case seeded successfully! 🎉 The Midnight Conductor is now ready.');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error seeding the database:', err);
        process.exit(1);
    });