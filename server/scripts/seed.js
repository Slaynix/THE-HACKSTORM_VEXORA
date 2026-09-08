'use strict';

require('dotenv').config();
const { getFirestore } = require('../config/firebase');

/**
 * Returns ISO date string shifted by N days from now (Asia/Kolkata).
 */
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

/**
 * Seeds the Patil family, members, 4 goals, and multi-day realistic deposits into Firestore.
 * @param {Object} [firestoreInstance]
 */
async function seedDatabase(firestoreInstance = null) {
  const db = firestoreInstance || getFirestore();
  console.log('🌱 [Seeder] Starting Firestore seeding for Sanchay+ (Patil Family)...');

  const familyId = 'fam-patil-1';

  // 1. Family
  const familyRef = db.collection('families').doc(familyId);
  await familyRef.set({
    name: 'Patil',
    preferredLanguage: 'en',
    createdAt: daysFromNow(-60),
    updatedAt: daysFromNow(0),
  });

  // 2. Users & Family Members
  const members = [
    {
      uid: 'user-patil-1',
      memberId: 'mem-arun',
      name: 'Arun Patil',
      email: 'arun.patil@example.com',
      role: 'admin',
      relation: 'Head of Family',
      phone: '+919876543210',
    },
    {
      uid: 'user-patil-2',
      memberId: 'mem-sunita',
      name: 'Sunita Patil',
      email: 'sunita.patil@example.com',
      role: 'member',
      relation: 'Mother',
      phone: '+919876543211',
    },
    {
      uid: 'user-patil-3',
      memberId: 'mem-riya',
      name: 'Riya Patil',
      email: '',
      role: 'member',
      relation: 'Daughter',
      phone: '',
    },
  ];

  for (const m of members) {
    if (m.uid) {
      await db.collection('users').doc(m.uid).set({
        email: m.email,
        phoneNumber: m.phone,
        familyId,
        memberName: m.name.split(' ')[0],
        role: m.role,
        createdAt: daysFromNow(-60),
        updatedAt: daysFromNow(0),
      });
    }

    await db.collection('familyMembers').doc(m.memberId).set({
      familyId,
      uid: m.uid,
      name: m.name,
      role: m.relation,
      phone: m.phone,
      createdAt: daysFromNow(-60),
      updatedAt: daysFromNow(0),
    });
  }

  // Clear existing goals, deposits, and milestones for this family for clean idempotence
  const existingGoals = await db.collection('goals').where('familyId', '==', familyId).get();
  const existingDeposits = await db.collection('deposits').where('familyId', '==', familyId).get();
  const existingMilestones = await db.collection('milestones').where('familyId', '==', familyId).get();
  const clearBatch = db.batch();
  existingGoals.forEach(doc => clearBatch.delete(doc.ref));
  existingDeposits.forEach(doc => clearBatch.delete(doc.ref));
  existingMilestones.forEach(doc => clearBatch.delete(doc.ref));
  await clearBatch.commit();

  // 3. Goals (as requested in specification)
  //   - School Fees — target ₹20,000
  //   - New Phone — target ₹15,000
  //   - Diwali Expenses — target ₹5,000
  //   - Farming Equipment — target ₹30,000
  const goals = [
    {
      id: 'goal-1',
      name: 'School Fees',
      category: 'education',
      icon: '📚',
      targetAmount: 20000,
      savedAmount: 12500, // 62.5% -> ON_TRACK
      deadline: daysFromNow(47),
      status: 'ON_TRACK',
      createdAt: daysFromNow(-53),
      updatedAt: daysFromNow(-1),
    },
    {
      id: 'goal-2',
      name: 'New Phone',
      category: 'phone',
      icon: '📱',
      targetAmount: 15000,
      savedAmount: 6000, // 40% -> AT_RISK
      deadline: daysFromNow(25),
      status: 'AT_RISK',
      createdAt: daysFromNow(-35),
      updatedAt: daysFromNow(-2),
    },
    {
      id: 'goal-3',
      name: 'Diwali Expenses',
      category: 'festival',
      icon: '🎉',
      targetAmount: 5000,
      savedAmount: 1200, // 24% -> BEHIND
      deadline: daysFromNow(18),
      status: 'BEHIND',
      createdAt: daysFromNow(-30),
      updatedAt: daysFromNow(-3),
    },
    {
      id: 'goal-4',
      name: 'Farming Equipment',
      category: 'farming',
      icon: '🌾',
      targetAmount: 30000,
      savedAmount: 18000, // 60% -> ON_TRACK
      deadline: daysFromNow(60),
      status: 'ON_TRACK',
      createdAt: daysFromNow(-45),
      updatedAt: daysFromNow(0),
    },
  ];

  for (const g of goals) {
    await db.collection('goals').doc(g.id).set({
      familyId,
      createdBy: 'user-patil-1',
      ...g,
    });
  }

  // 4. Deposits spread across recent dates
  const deposits = [
    // School Fees deposits (total: 12,500)
    { id: 'dep-sf-1', goalId: 'goal-1', amount: 3000, notes: 'Crop sale initial share', daysAgo: -50, memberId: 'mem-arun', memberName: 'Arun' },
    { id: 'dep-sf-2', goalId: 'goal-1', amount: 2500, notes: 'Vegetable market surplus', daysAgo: -38, memberId: 'mem-sunita', memberName: 'Sunita' },
    { id: 'dep-sf-3', goalId: 'goal-1', amount: 2000, notes: 'Monthly school fund saving', daysAgo: -24, memberId: 'mem-arun', memberName: 'Arun' },
    { id: 'dep-sf-4', goalId: 'goal-1', amount: 2000, notes: 'Weekly harvest saving', daysAgo: -14, memberId: 'mem-arun', memberName: 'Arun' },
    { id: 'dep-sf-5', goalId: 'goal-1', amount: 1500, notes: 'Saved from grocery budget', daysAgo: -7,  memberId: 'mem-sunita', memberName: 'Sunita' },
    { id: 'dep-sf-6', goalId: 'goal-1', amount: 1500, notes: 'Dairy payment deposit', daysAgo: -1,  memberId: 'mem-arun', memberName: 'Arun' },

    // New Phone deposits (total: 6,000)
    { id: 'dep-np-1', goalId: 'goal-2', amount: 2000, notes: 'Initial phone fund deposit', daysAgo: -30, memberId: 'mem-arun', memberName: 'Arun' },
    { id: 'dep-np-2', goalId: 'goal-2', amount: 1500, notes: 'Overtime bonus saved', daysAgo: -18, memberId: 'mem-arun', memberName: 'Arun' },
    { id: 'dep-np-3', goalId: 'goal-2', amount: 1000, notes: 'Weekly micro-saving', daysAgo: -10, memberId: 'mem-arun', memberName: 'Arun' },
    { id: 'dep-np-4', goalId: 'goal-2', amount: 1000, notes: 'Festival advance savings', daysAgo: -5,  memberId: 'mem-sunita', memberName: 'Sunita' },
    { id: 'dep-np-5', goalId: 'goal-2', amount: 500,  notes: 'Chai money cut', daysAgo: -2,  memberId: 'mem-arun', memberName: 'Arun' },

    // Diwali Expenses deposits (total: 1,200)
    { id: 'dep-de-1', goalId: 'goal-3', amount: 500, notes: 'Diwali sweet fund starter', daysAgo: -25, memberId: 'mem-sunita', memberName: 'Sunita' },
    { id: 'dep-de-2', goalId: 'goal-3', amount: 400, notes: 'Tailoring income saved', daysAgo: -12, memberId: 'mem-sunita', memberName: 'Sunita' },
    { id: 'dep-de-3', goalId: 'goal-3', amount: 300, notes: 'Market discount savings', daysAgo: -3,  memberId: 'mem-arun', memberName: 'Arun' },

    // Farming Equipment deposits (total: 18,000)
    { id: 'dep-fe-1', goalId: 'goal-4', amount: 5000, notes: 'Paddy harvest income', daysAgo: -42, memberId: 'mem-arun', memberName: 'Arun' },
    { id: 'dep-fe-2', goalId: 'goal-4', amount: 4000, notes: 'Cotton seed advance sale', daysAgo: -30, memberId: 'mem-arun', memberName: 'Arun' },
    { id: 'dep-fe-3', goalId: 'goal-4', amount: 3500, notes: 'Tractor rental earning saved', daysAgo: -20, memberId: 'mem-arun', memberName: 'Arun' },
    { id: 'dep-fe-4', goalId: 'goal-4', amount: 3000, notes: 'Wheat produce profit', daysAgo: -10, memberId: 'mem-arun', memberName: 'Arun' },
    { id: 'dep-fe-5', goalId: 'goal-4', amount: 2500, notes: 'Weekly agricultural deposit', daysAgo: 0,   memberId: 'mem-arun', memberName: 'Arun' },
  ];


  for (const d of deposits) {
    const dateStr = daysFromNow(d.daysAgo);
    await db.collection('deposits').doc(d.id).set({
      familyId,
      goalId: d.goalId,
      memberId: d.memberId,
      memberName: d.memberName,
      amount: d.amount,
      depositDate: dateStr,
      source: 'manual',
      notes: d.notes,
      clientTxnId: `txn-${d.id}`,
      createdAt: dateStr,
      updatedAt: dateStr,
    });
  }

  // 5. Notifications
  const notifications = [
    {
      id: 'notif-1',
      familyId,
      type: 'reminder',
      title: 'Time to save!',
      body: 'Save ₹100 today toward New Phone to stay on track.',
      read: false,
      date: daysFromNow(0),
      createdAt: daysFromNow(0),
    },
    {
      id: 'notif-2',
      familyId,
      type: 'warning',
      title: 'Goal at risk',
      body: 'Diwali Expenses is falling behind. Save ₹210/day to catch up.',
      read: false,
      date: daysFromNow(-1),
      createdAt: daysFromNow(-1),
    },
    {
      id: 'notif-3',
      familyId,
      type: 'milestone',
      title: '50% milestone reached! 🏆',
      body: 'School Fees is 62% completed. Great consistency!',
      read: true,
      date: daysFromNow(-2),
      createdAt: daysFromNow(-2),
    },
    {
      id: 'notif-4',
      familyId,
      type: 'success',
      title: 'Deposit recorded! ✅',
      body: 'Arun saved ₹2,500 toward Farming Equipment.',
      read: true,
      date: daysFromNow(0),
      createdAt: daysFromNow(0),
    },
  ];

  for (const n of notifications) {
    await db.collection('notifications').doc(n.id).set(n);
  }

  // 6. Milestones (initial achieved milestones)
  const milestones = [
    { id: 'm-sf-25', familyId, goalId: 'goal-1', goalName: 'School Fees', percentage: 25, amountAtMilestone: 5500, achievedAt: daysFromNow(-38) },
    { id: 'm-sf-50', familyId, goalId: 'goal-1', goalName: 'School Fees', percentage: 50, amountAtMilestone: 11000, achievedAt: daysFromNow(-7) },
    { id: 'm-fe-25', familyId, goalId: 'goal-4', goalName: 'Farming Equipment', percentage: 25, amountAtMilestone: 9000, achievedAt: daysFromNow(-30) },
    { id: 'm-fe-50', familyId, goalId: 'goal-4', goalName: 'Farming Equipment', percentage: 50, amountAtMilestone: 15500, achievedAt: daysFromNow(-10) },
    { id: 'm-np-25', familyId, goalId: 'goal-2', goalName: 'New Phone', percentage: 25, amountAtMilestone: 4500, achievedAt: daysFromNow(-10) },
  ];
  for (const m of milestones) {
    await db.collection('milestones').doc(m.id).set({ ...m, createdAt: m.achievedAt });
  }

  // 7. Saving Streak for Patil Family
  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  await db.collection('savingStreaks').doc(familyId).set({
    familyId,
    currentStreak: 5,
    longestStreak: 12,
    lastSavingDate: todayIST,
    updatedAt: daysFromNow(0),
    createdAt: daysFromNow(-60),
  });

  console.log(`✅ [Seeder] Seeding finished successfully:`);
  console.log(`   - 1 Family (Patil)`);
  console.log(`   - ${members.length} Members (Arun, Sunita, Riya)`);
  console.log(`   - ${goals.length} Goals (School Fees ₹20k, Phone ₹15k, Diwali ₹5k, Farming ₹30k)`);
  console.log(`   - ${deposits.length} Realistic Deposits across multiple dates`);
  console.log(`   - ${milestones.length} Milestone Records (Idempotency Base)`);
  console.log(`   - 1 Saving Streak (Current: 5 days, Longest: 12 days)`);
  console.log(`   - ${notifications.length} Sample Notifications`);

  return {
    success: true,
    familyCount: 1,
    memberCount: members.length,
    goalCount: goals.length,
    depositCount: deposits.length,
    notificationCount: notifications.length,
  };
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ [Seeder] Failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
