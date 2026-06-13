/**
 * CrimeSolve — Seed Case: "The Midnight Conductor"
 * ==================================================
 * A MEDIUM-difficulty murder case (R-rated).
 * Duration: 72 real-world hours (3 days)
 *
 * SYNOPSIS (DO NOT EXPOSE TO PLAYERS):
 * Victor Hale, a famous orchestra conductor, is found dead
 * in his dressing room after a sold-out concert. The cause
 * of death appears to be a heart attack — but the toxicology
 * will reveal he was poisoned.
 *
 * THE TWIST: The poison was in his personal whiskey flask,
 * but THREE people handled it that night. The real killer is
 * Elena Marsh, the second violinist, who discovered Victor
 * had been embezzling from the orchestra's charitable fund
 * — money that was supposed to go to her dying mother's
 * medical care.
 *
 * Red herrings:
 *  - Marcus Webb (stage manager) had a violent argument with Victor
 *  - Dr. Ida Voss had a forged prescription found in her bag
 *  - Thomas Hale (Victor's son) was the sole beneficiary of the will
 */

module.exports = {
    caseId:       'case_midnight_conductor',
    title:        'The Midnight Conductor',
    tagline:      'The applause had barely faded. The poison already had.',
    caseNumber:   'CS-2024-001',
    category:     'murder',
    contentRating:'R',
    difficulty:   'medium',
    durationHours: 72,
    timelineLabel: '3 days',

    setting: {
        city:    'Vienna',
        country: 'Austria',
        year:    2024,
        era:     'modern',
    },

    briefingText: `
    At 11:47 PM on Friday, Victor Hale — the celebrated conductor of the
    Vienna Metropolitan Orchestra — was found unresponsive in his private
    dressing room backstage at the Goldener Saal concert hall.

    Emergency services declared him dead at the scene. Initial assessment
    suggests cardiac arrest. He was 58 years old and reportedly in good health.

    You have been assigned to the case. The hall has been sealed. Eight people
    were present backstage during the window of death. The concert ended at 11:15 PM.

    You have 72 hours before the press breaks the story.
  `,

    victimName:    'Victor Hale',
    victimAge:     58,
    victimProfile: `
    Victor Hale was one of Europe's most decorated conductors. Notoriously
    demanding, secretly generous — he founded the Orchestra's charitable fund
    himself. Divorced twice. One son: Thomas. Known to drink whiskey from a
    personal flask during intermission.
  `,

    trueNarrative: `
    Elena Marsh discovered three months ago that Victor had been quietly
    redirecting $40,000/year from the Orchestra's charitable fund into a
    shell account. That money was specifically earmarked for musicians'
    families in medical need — including her mother, who has terminal cancer.

    Elena is a trained pharmacist (before switching careers to music). She
    obtained potassium chloride from a hospital contact — enough to induce
    cardiac arrest with no external signs. She introduced it into Victor's
    personal whiskey flask during the intermission when he left his dressing
    room to speak with a sponsor.

    She did not intend for it to look like a murder. She knew a blood panel
    would show natural cardiac markers. She was counting on no toxicology.
    She was almost right.
  `,

    conclusionText: `
    Elena Marsh is placed under arrest. In her police interview she does not
    deny it. "He was stealing from dying people," she says. "I gave him the
    death he designed for others."

    The charitable fund embezzlement is confirmed. Victor Hale had diverted
    €180,000 over four years. Elena's mother passes away six days later.

    The case closes. The concert hall reopens two weeks later.
    They play Beethoven's Fifth. Elena's seat is empty.
  `,

    // ──────────────────────────────────────────
    //  SUSPECTS
    // ──────────────────────────────────────────
    suspects: [
        {
            suspectId:    'suspect_elena_marsh',
            name:         'Elena Marsh',
            age:          34,
            occupation:   'Second Violinist, VMO',
            relationship: 'Subordinate / Victim\'s employee',
            avatarKey:    'female_professional_1',
            motive:       'Discovered Victor embezzling charitable fund that denied her mother medical care',
            isRealCulprit: true,
            personality: {
                trait:        'composed',
                liesAbout:    ['her relationship with Victor', 'her pharmacy background', 'where she was at intermission'],
                giveawayTell: 'Rubs her left thumb over her ring finger when lying — a self-soothing habit'
            },
            alibiChain: [
                {
                    layerIndex:   0,
                    statement:    'I was in the green room with the other string players from 10:50 PM until the end. You can ask anyone.',
                    crackedByClue: 'clue_cctv_gap',
                    revealText:   'CCTV shows Elena leaving the green room for 11 minutes at 10:52 PM — exactly when Victor\'s dressing room was empty.',
                },
                {
                    layerIndex:   1,
                    statement:    'Fine. I went to get my phone charger from the props room. Victor\'s door was closed. I didn\'t go in.',
                    crackedByClue: 'clue_flask_partial_print',
                    revealText:   'A partial print on the inner neck of Victor\'s flask matches Elena\'s right index finger.',
                },
                {
                    layerIndex:   2,
                    statement:    'I touched his flask earlier in the evening. He offered me a drink before the performance. That\'s all.',
                    crackedByClue: 'clue_potassium_source',
                    revealText:   'Elena\'s former pharmacy colleague confirms she requested potassium chloride samples three weeks ago "for a private research project."',
                },
            ]
        },
        {
            suspectId:    'suspect_marcus_webb',
            name:         'Marcus Webb',
            age:          47,
            occupation:   'Stage Manager, VMO',
            relationship: 'Long-time employee, recent conflict',
            avatarKey:    'male_middleaged_1',
            motive:       'Victor threatened to fire him after 19 years over a lighting rig incident',
            isRealCulprit: false,
            personality: {
                trait:        'aggressive',
                liesAbout:    ['the argument witnesses heard', 'his fingerprints on dressing room door'],
                giveawayTell: 'Raises his voice when cornered — deflects with counter-accusations'
            },
            alibiChain: [
                {
                    layerIndex:   0,
                    statement:    'Victor and I argued. So what? Everyone argues with Victor. I was on stage rigging until midnight.',
                    crackedByClue: 'clue_rig_log',
                    revealText:   'Stage rigging logs show Marcus clocked out at 10:40 PM — 70 minutes unaccounted for.',
                },
                {
                    layerIndex:   1,
                    statement:    'I was in the loading dock having a smoke. Alone. I didn\'t want to be around people after that argument.',
                    crackedByClue: 'clue_cigarette_stub',
                    revealText:   'Only one cigarette stub found at the loading dock — stub is from a brand Marcus doesn\'t smoke. (Red herring confirmed: alibi is weak but truthful.)',
                },
            ]
        },
        {
            suspectId:    'suspect_thomas_hale',
            name:         'Thomas Hale',
            age:          29,
            occupation:   'Freelance Photographer',
            relationship: 'Victor\'s estranged son',
            avatarKey:    'male_young_1',
            motive:       'Sole beneficiary of Victor\'s €2.1M estate. Had not spoken to father in 3 years.',
            isRealCulprit: false,
            personality: {
                trait:        'nervous',
                liesAbout:    ['why he came to the concert', 'a phone call he made at 11:00 PM'],
                giveawayTell: 'Over-explains unprompted — provides unnecessary detail when innocent'
            },
            alibiChain: [
                {
                    layerIndex:   0,
                    statement:    'I was in the audience the entire performance. Check the ticket scan. I didn\'t go backstage.',
                    crackedByClue: 'clue_backstage_pass',
                    revealText:   'A backstage day pass with Thomas\'s name was issued at 10:30 PM by the box office.',
                },
                {
                    layerIndex:   1,
                    statement:    'Dad invited me. He wanted to reconcile. I came backstage at 10:30, we talked for 20 minutes, I left. That\'s the truth.',
                    crackedByClue: 'clue_thomas_phone_call',
                    revealText:   'Thomas\'s 11:00 PM call was to his own lawyer — not suspicious. He was calling to update his own will, unrelated to his father\'s death. (Confirmed innocent.)',
                },
            ]
        },
        {
            suspectId:    'suspect_ida_voss',
            name:         'Dr. Ida Voss',
            age:          52,
            occupation:   'Orchestra Physician',
            relationship: 'Staff doctor, on-call during events',
            avatarKey:    'female_older_1',
            motive:       'Victor had discovered she was over-prescribing painkillers to musicians and threatened to report her',
            isRealCulprit: false,
            personality: {
                trait:        'evasive',
                liesAbout:    ['the prescription found in her bag', 'her last conversation with Victor'],
                giveawayTell: 'Goes very quiet and formal — gives clinical, distant answers when stressed'
            },
            alibiChain: [
                {
                    layerIndex:   0,
                    statement:    'I was in the medical room all evening. I treated a flute player for a sprained wrist at 9:45 PM. I didn\'t see Victor after intermission.',
                    crackedByClue: 'clue_forged_prescription',
                    revealText:   'A prescription in Dr. Voss\'s handwriting for a controlled opioid was found in her bag — written to a musician who claims they never requested it.',
                },
                {
                    layerIndex:   1,
                    statement:    'Those prescriptions are a private matter — a mistake I\'ve been trying to correct. It has nothing to do with Victor\'s death.',
                    crackedByClue: 'clue_voss_victor_email',
                    revealText:   'An email from Victor to Dr. Voss, sent three days before his death: "I know about the prescriptions. Come see me before Friday or I call the medical board." — Victor was blackmailing her, but the toxicology (potassium chloride) rules out her pharmaceutical access as the method. She had motive but no opportunity.',
                },
            ]
        },
    ],

    // ──────────────────────────────────────────
    //  SCENES
    // ──────────────────────────────────────────
    scenes: [
        {
            sceneId:        'scene_dressing_room',
            name:           'Victor\'s Dressing Room',
            description:    'A private dressing room backstage. Dimly lit. A half-empty whiskey glass on the vanity. The body has been removed but the scene is intact.',
            environmentKey: 'env_dressing_room_01',
            unlocksAt:      null,  // available from start
            atmosphere: {
                baseAmbience:  'night',
                hauntingLevel: 2,
                jumpScarePool: ['scare_mirror_reflection', 'scare_door_creak', 'scare_light_flicker'],
            },
            clueIds: ['clue_whiskey_flask', 'clue_vanity_note', 'clue_dressing_room_key', 'clue_medical_bag'],
        },
        {
            sceneId:        'scene_green_room',
            name:           'Green Room',
            description:    'The backstage lounge where musicians gathered before and after the performance. Coffee cups still on the table. A shared coat rack.',
            environmentKey: 'env_green_room_01',
            unlocksAt:      null,
            atmosphere: {
                baseAmbience:  'night',
                hauntingLevel: 0,
                jumpScarePool: [],
            },
            clueIds: ['clue_cctv_gap', 'clue_elena_coat', 'clue_green_room_cctv'],
        },
        {
            sceneId:        'scene_concert_hall',
            name:           'The Goldener Saal — Backstage',
            description:    'The grand backstage corridor leading to the main stage. Stage rigging above. Prop storage to the left.',
            environmentKey: 'env_concert_hall_backstage_01',
            unlocksAt:      null,
            atmosphere: {
                baseAmbience:  'night',
                hauntingLevel: 3,
                jumpScarePool: ['scare_shadow_figure', 'scare_instrument_sound'],
            },
            clueIds: ['clue_rig_log', 'clue_cigarette_stub', 'clue_backstage_pass'],
        },
        {
            sceneId:        'scene_medical_room',
            name:           'Medical Room',
            description:    'The on-site medical room. Locked cabinet. Dr. Voss\'s personal bag left behind.',
            environmentKey: 'env_medical_room_01',
            unlocksAt:      'clue_medical_bag',  // unlocks when player finds key in dressing room
            atmosphere: {
                baseAmbience:  'day',
                hauntingLevel: 1,
                jumpScarePool: ['scare_cabinet_door'],
            },
            clueIds: ['clue_forged_prescription', 'clue_potassium_source'],
        },
        {
            sceneId:        'scene_archive',
            name:           'Orchestra Administrative Archive',
            description:    'A locked filing room. Financial records. Victor\'s private correspondence.',
            environmentKey: 'env_archive_01',
            unlocksAt:      'clue_vanity_note',  // note in dressing room points here
            atmosphere: {
                baseAmbience:  'day',
                hauntingLevel: 0,
                jumpScarePool: [],
            },
            clueIds: ['clue_fund_ledger', 'clue_shell_account', 'clue_voss_victor_email', 'clue_elena_letter'],
        },
    ],

    // ──────────────────────────────────────────
    //  CLUES
    // ──────────────────────────────────────────
    clues: [
        // — Root clues (visible at scene entry) —
        {
            clueId:         'clue_whiskey_flask',
            parentClueId:   null,
            label:          'Victor\'s personal whiskey flask',
            description:    'A sterling silver flask engraved "VH" on the front. Residue at the bottom. Cap loosely replaced.',
            location:       'scene_dressing_room',
            type:           'physical',
            isRedHerring:   false,
            pointsToSuspect: 'suspect_elena_marsh',
            requiresLabWork: true,
            labResultDelay:  240,  // 4 hrs for medium difficulty
            labResultText:   'Flask residue contains potassium chloride at a concentration sufficient to induce cardiac arrest. No fingerprints on exterior (wiped). Partial print on interior neck.',
            weatherSensitive: false,
        },
        {
            clueId:         'clue_flask_partial_print',
            parentClueId:   'clue_whiskey_flask',  // unlocks after lab analysis
            label:          'Partial fingerprint — flask neck',
            description:    'The partial print extracted from the interior neck of the flask. A right index finger, smudged but usable.',
            location:       'scene_dressing_room',
            type:           'forensic',
            isRedHerring:   false,
            pointsToSuspect: 'suspect_elena_marsh',
            requiresLabWork: true,
            labResultDelay:  360,
            labResultText:   'Print matches Elena Marsh, second violinist. Right index finger, 8-point match.',
            weatherSensitive: false,
        },
        {
            clueId:         'clue_vanity_note',
            parentClueId:   null,
            label:          'Handwritten note on the vanity mirror',
            description:    'A yellow sticky note in Victor\'s handwriting: "Archive — K. confirm ledger Fri." Partially obscured by a makeup brush.',
            location:       'scene_dressing_room',
            type:           'document',
            isRedHerring:   false,
            pointsToSuspect: null,
            requiresLabWork: false,
            weatherSensitive: false,
        },
        {
            clueId:         'clue_medical_bag',
            parentClueId:   null,
            label:          'Abandoned medical bag — dressing room corner',
            description:    'A physician\'s bag left in the corner, marked with an "IV" monogram. Contains a stethoscope, prescription pad, and a set of keys including one marked "MED."',
            location:       'scene_dressing_room',
            type:           'physical',
            isRedHerring:   false,
            pointsToSuspect: 'suspect_ida_voss',
            requiresLabWork: false,
            weatherSensitive: false,
        },
        {
            clueId:         'clue_cctv_gap',
            parentClueId:   null,
            label:          'CCTV footage — green room exit',
            description:    'Security footage from the green room corridor shows Elena Marsh leaving at 10:52 PM and returning at 11:03 PM — 11 minutes. She does not appear on any other camera during this time.',
            location:       'scene_green_room',
            type:           'digital',
            isRedHerring:   false,
            pointsToSuspect: 'suspect_elena_marsh',
            requiresLabWork: false,
            weatherSensitive: false,
        },
        {
            clueId:         'clue_rig_log',
            parentClueId:   null,
            label:          'Stage rigging digital log',
            description:    'The automated stage rigging system logs all operator sessions. Marcus Webb\'s card shows clock-in at 6:15 PM and clock-out at 10:40 PM. A 70-minute gap before midnight.',
            location:       'scene_concert_hall',
            type:           'digital',
            isRedHerring:   true,  // red herring — Marcus is innocent
            pointsToSuspect: 'suspect_marcus_webb',
            requiresLabWork: false,
            weatherSensitive: false,
        },
        {
            clueId:         'clue_backstage_pass',
            parentClueId:   null,
            label:          'Backstage day pass — Thomas Hale',
            description:    'A printed backstage pass issued at 10:30 PM from the box office. Name: Thomas Hale. Single entry, stamped used.',
            location:       'scene_concert_hall',
            type:           'document',
            isRedHerring:   true,  // red herring — Thomas is innocent
            pointsToSuspect: 'suspect_thomas_hale',
            requiresLabWork: false,
            weatherSensitive: false,
        },
        {
            clueId:         'clue_forged_prescription',
            parentClueId:   null,
            label:          'Forged prescription — Dr. Voss\'s bag',
            description:    'A prescription for 60mg oxycodone in Dr. Voss\'s handwriting. The patient name has been lightly altered. The signature is genuine.',
            location:       'scene_medical_room',
            type:           'document',
            isRedHerring:   true,  // red herring — Voss had motive, not opportunity
            pointsToSuspect: 'suspect_ida_voss',
            requiresLabWork: false,
            weatherSensitive: false,
        },
        {
            clueId:         'clue_potassium_source',
            parentClueId:   'clue_forged_prescription',  // unlocks when player investigates Voss's supplies
            label:          'Pharmacy contact records',
            description:    'A search of Elena Marsh\'s personal email (warrant required — served at hour 36) reveals a message to a former pharmacy colleague: "Can you set aside some K-Cl solution for me? Personal project. Don\'t need much."',
            location:       'scene_medical_room',
            type:           'digital',
            isRedHerring:   false,
            pointsToSuspect: 'suspect_elena_marsh',
            requiresLabWork: false,
            weatherSensitive: false,
        },
        {
            clueId:         'clue_fund_ledger',
            parentClueId:   null,
            label:          'Orchestra charitable fund ledger',
            description:    'The fund\'s official ledger shows consistent donations. But a cross-reference with the bank statements reveals €40,000/year is being redirected to "Administrative Processing Fees" — a line item that doesn\'t exist in the budget.',
            location:       'scene_archive',
            type:           'document',
            isRedHerring:   false,
            pointsToSuspect: null,  // points to motive, not directly to a suspect
            requiresLabWork: false,
            weatherSensitive: false,
        },
        {
            clueId:         'clue_shell_account',
            parentClueId:   'clue_fund_ledger',
            label:          'Shell account — beneficial owner traced',
            description:    'Financial forensics (48hr lab turnaround) trace the "Administrative Fees" to a shell company — Halecroft Partners Ltd — whose sole beneficial owner is Victor Hale.',
            location:       'scene_archive',
            type:           'forensic',
            isRedHerring:   false,
            pointsToSuspect: null,
            requiresLabWork: true,
            labResultDelay:  480,
            labResultText:   'Halecroft Partners Ltd. registered 2019, Gibraltar. Sole director and beneficial owner: Victor William Hale, DOB 12/03/1966. Total inflows: €183,420 over 4 years.',
            weatherSensitive: false,
        },
        {
            clueId:         'clue_elena_letter',
            parentClueId:   'clue_fund_ledger',
            label:          'Elena\'s rejected grant application',
            description:    'A printed email from the Orchestra\'s fund committee, signed by Victor: "We regret that the Marsh Family Medical Assistance application cannot be approved at this time due to insufficient remaining funds." Dated six weeks ago.',
            location:       'scene_archive',
            type:           'document',
            isRedHerring:   false,
            pointsToSuspect: 'suspect_elena_marsh',
            requiresLabWork: false,
            weatherSensitive: false,
        },
        {
            clueId:         'clue_voss_victor_email',
            parentClueId:   null,
            label:          'Victor\'s draft email to Dr. Voss',
            description:    'An unsent draft in Victor\'s laptop (found in archive desk): "Ida — I know about the oxycodone. Come see me before Friday or I go to the board." Written Tuesday. Victor died Friday.',
            location:       'scene_archive',
            type:           'digital',
            isRedHerring:   true,
            pointsToSuspect: 'suspect_ida_voss',
            requiresLabWork: false,
            weatherSensitive: false,
        },
        {
            clueId:         'clue_thomas_phone_call',
            parentClueId:   'clue_backstage_pass',
            label:          'Thomas\'s 11:00 PM phone call',
            description:    'Phone records show Thomas Hale placed a 4-minute call at 11:02 PM to Schneider & Braun Attorneys. The firm confirms: Thomas was updating his own will, predating his father\'s death.',
            location:       'scene_concert_hall',
            type:           'digital',
            isRedHerring:   true,
            pointsToSuspect: null,
            requiresLabWork: false,
            weatherSensitive: false,
        },
        // Weather-sensitive clue — exists only if scene is accessed early (before rain)
        {
            clueId:         'clue_elena_coat',
            parentClueId:   null,
            label:          'Elena\'s coat pocket — small glass vial',
            description:    'Inside Elena\'s coat left on the green room rack: a small empty glass vial, the kind used in medical settings for liquid solutions. Residue inside.',
            location:       'scene_green_room',
            type:           'physical',
            isRedHerring:   false,
            pointsToSuspect: 'suspect_elena_marsh',
            requiresLabWork: true,
            labResultDelay:  180,
            labResultText:   'Vial residue: potassium chloride solution, medical grade. Concentration matches flask residue exactly. Same batch.',
            weatherSensitive: true,
            degradesInRain:  false,
            degradesAtNight: false,
            // This clue is destroyed if Elena is interrogated before it's found
            // (she removes the coat) — tracked in game engine, not here
        },
    ],

    // ──────────────────────────────────────────
    //  TWISTS
    // ──────────────────────────────────────────
    twists: [
        {
            twistId:      'twist_not_heart_attack',
            title:        'It Wasn\'t His Heart',
            narrativeText: `
        The preliminary autopsy arrives. Cause of death was not cardiac arrest.
        Toxicology shows elevated potassium chloride in the bloodstream — far beyond
        natural levels. Victor Hale was poisoned. This is now a murder investigation.
        The concert hall is resealed. Every person backstage is now a suspect.
      `,
            triggerType:  'lab_result_received',
            triggerId:    'clue_whiskey_flask',  // fires when flask lab result comes in
            effects: {
                newSuspectUnlocked:   null,
                newSceneUnlocked:     'scene_archive',  // archive access granted after murder confirmed
                cluesInvalidated:     [],
                weatherShift:         'sudden_rain',    // it starts raining — atmospheric
                jumpScareEvent:       null,
            }
        },
        {
            twistId:      'twist_fund_embezzlement',
            title:        'The Money Was Never There',
            narrativeText: `
        The charitable fund has been systematically drained. Four years.
        €183,000. The same fund that pays for musicians' families in crisis.
        Victor Hale — the man who created it — was stealing from it.
        Someone in that orchestra knew. And they decided to do something about it.
      `,
            triggerType:  'clue_found',
            triggerId:    'clue_shell_account',
            effects: {
                newSuspectUnlocked:   null,
                newSceneUnlocked:     null,
                cluesInvalidated:     [],
                weatherShift:         'dense_fog',
                jumpScareEvent:       'scare_victor_whisper',  // eerie ambient event
            }
        },
        {
            twistId:      'twist_elena_mother',
            title:        'She Had a Reason',
            narrativeText: `
        Elena Marsh submitted a grant application to the very fund Victor was
        stealing from. Her mother has terminal cancer. The application was
        rejected — "insufficient funds."

        At that exact moment, Victor Hale was transferring €40,000 to his
        private account.

        Elena knew. She found out eight weeks ago. She didn't go to the police.
        She went to a pharmacy.
      `,
            triggerType:  'clue_found',
            triggerId:    'clue_elena_letter',
            effects: {
                newSuspectUnlocked:   null,
                newSceneUnlocked:     null,
                cluesInvalidated:     ['clue_rig_log', 'clue_forged_prescription'],  // these red herrings now feel less important
                weatherShift:         null,
                jumpScareEvent:       null,
            }
        },
    ],

    // ──────────────────────────────────────────
    //  PASSIVE TIMERS
    // ──────────────────────────────────────────
    passiveTimers: [
        {
            timerId:     'timer_flask_toxicology',
            label:       'Toxicology — Whiskey Flask',
            description: 'Flask contents sent to the forensic lab for full chemical analysis.',
            resultClueId:'clue_whiskey_flask',  // delivers the lab result for this clue
            notificationTitle: '🔬 Lab Results In — Victor\'s Flask',
            notificationBody:  'The toxicology report on the whiskey flask has been completed. Check your case files.',
            durationByDifficulty: {
                easy:    60,    // 1 hour
                medium:  240,   // 4 hours
                hard:    480,   // 8 hours
                extreme: 1440,  // 24 hours
            }
        },
        {
            timerId:     'timer_fingerprint_match',
            label:       'Fingerprint Analysis',
            description: 'The partial print from the flask interior sent for AFIS matching.',
            resultClueId:'clue_flask_partial_print',
            notificationTitle: '🖐 Fingerprint Match Found',
            notificationBody:  'AFIS has returned a match on the partial print from the flask. The results may surprise you.',
            durationByDifficulty: {
                easy:    90,
                medium:  360,
                hard:    720,
                extreme: 2880,
            }
        },
        {
            timerId:     'timer_shell_account',
            label:       'Financial Forensics — Shell Company Trace',
            description: 'International financial investigation into Halecroft Partners Ltd.',
            resultClueId:'clue_shell_account',
            notificationTitle: '💰 Financial Trace Complete',
            notificationBody:  'The beneficial owner of Halecroft Partners has been identified. The fund\'s money has been followed.',
            durationByDifficulty: {
                easy:    120,
                medium:  480,
                hard:    960,
                extreme: 2880,
            }
        },
    ],

    // ──────────────────────────────────────────
    //  WEATHER
    // ──────────────────────────────────────────
    weather: {
        baseClimate:       'temperate',
        season:            'autumn',
        stormProbability:  0.35,
        scriptedEvents: [
            { atTwistId: 'twist_not_heart_attack', weatherType: 'sudden_rain', durationMins: 60 },
            { atTwistId: 'twist_fund_embezzlement', weatherType: 'dense_fog', durationMins: 120 },
        ]
    },

    soundtrackKey: 'ost_gothic_orchestra',
    jumpScarePool: [
        'scare_mirror_reflection',
        'scare_door_creak',
        'scare_shadow_figure',
        'scare_instrument_sound',
        'scare_victor_whisper',
        'scare_light_flicker',
        'scare_cabinet_door',
    ],

    // ──────────────────────────────────────────
    //  MULTIPLAYER ROLES
    // ──────────────────────────────────────────
    maxPlayers: 4,
    roles: [
        {
            roleId: 'lead_detective',
            label:  'Lead Detective',
            perks:  ['can_interrogate_suspects', 'can_make_accusations', 'can_request_warrants']
        },
        {
            roleId: 'forensics',
            label:  'Forensics Specialist',
            perks:  ['can_submit_lab_work', 'sees_lab_results_first', 'can_analyze_crime_scene']
        },
        {
            roleId: 'analyst',
            label:  'Intelligence Analyst',
            perks:  ['can_access_digital_records', 'can_trace_financial_data', 'has_cctv_access']
        },
        {
            roleId: 'field_investigator',
            label:  'Field Investigator',
            perks:  ['can_unlock_scenes', 'finds_physical_clues_faster', 'can_tail_suspects']
        },
    ],
};