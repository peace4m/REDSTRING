/**
 * Redstring — AI Dialogue Engine
 * =================================
 * Uses the Anthropic API to generate realistic, dynamic suspect dialogue.
 *
 * Why LLM for dialogue?
 *  - Players can ask suspects anything in free text
 *  - Suspects must stay in character and lie convincingly
 *  - Responses need to feel different every interrogation
 *  - A suspect's personality trait must shape every answer
 *
 * The game engine handles the LOGIC of alibi cracking.
 * This engine handles the WORDS the suspect actually says.
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
//  SUSPECT DIALOGUE
// ─────────────────────────────────────────────

/**
 * Generate a suspect's in-character response to a player's question.
 *
 * @param {object} context - From interrogateSuspect's aiPromptContext
 * @param {string} baseStatement - The alibi statement for current layer
 * @param {string} playerQuestion - What the player typed/asked
 */
async function generateSuspectDialogue(context, baseStatement, playerQuestion = '') {
    const {
        suspectPersonality,
        alibiBroke,
        evidencePresented,
        sessionHistory,
    } = context;

    const systemPrompt = `You are playing the character of a suspect in a murder mystery game.

PERSONALITY: ${suspectPersonality.trait}
LIES ABOUT: ${suspectPersonality.liesAbout?.join(', ')}
BEHAVIORAL TELL WHEN LYING: ${suspectPersonality.giveawayTell}

CURRENT ALIBI STATUS: ${alibiBroke ? 'Your alibi was just BROKEN. You must adapt and give a new partial confession while still concealing the full truth.' : 'Your alibi is holding. Stay consistent with your story.'}

BASE ALIBI STATEMENT: "${baseStatement}"

RULES:
- Stay completely in character. Never break the fourth wall.
- If your alibi was just broken by evidence, react naturally — be defensive, shift blame, or partially admit something minor while protecting the real secret.
- Use your personality trait in every response: "${suspectPersonality.trait}" people speak in a specific way.
- If asked about topics you lie about, deflect, minimise, or misdirect — but don't be robotically evasive.
- Keep responses to 2-4 sentences. This is a tense police interrogation, not a monologue.
- DO NOT confess to the crime unless the player has presented overwhelming, specific evidence.
- Show your behavioral tell (${suspectPersonality.giveawayTell}) subtly through action cues in italics.

Previous evidence presented: ${sessionHistory?.join(', ') || 'none'}`;

    const userMessage = playerQuestion
        ? `The detective asks: "${playerQuestion}"`
        : `The detective is studying you silently after presenting evidence: "${evidencePresented || 'your inconsistencies'}"`;

    try {
        const response = await client.messages.create({
            model:      'claude-sonnet-4-20250514',
            max_tokens: 250,
            system:     systemPrompt,
            messages:   [{ role: 'user', content: userMessage }],
        });

        return response.content[0]?.text || baseStatement;
    } catch (err) {
        console.error('[AI] Dialogue generation failed:', err.message);
        return baseStatement; // Fall back to a scripted statement
    }
}

// ─────────────────────────────────────────────
//  JUMP SCARE NARRATION
// ─────────────────────────────────────────────

/**
 * Generate a short atmospheric text narration for a jump scare event.
 * Displayed as flavor text on the screen during the scare.
 *
 * @param {string} scareKey     - e.g. "scare_shadow_figure"
 * @param {string} sceneId      - current scene
 * @param {string} caseTitle    - for context
 */
async function generateJumpScareText(scareKey, sceneId, caseTitle) {
    const scareDescriptions = {
        scare_mirror_reflection:   'A figure appears briefly in a mirror',
        scare_door_creak:          'A door slowly creaks open on its own',
        scare_shadow_figure:       'A dark silhouette moves across the corridor',
        scare_instrument_sound:    'A single discordant note plays from an instrument that should be silent',
        scare_victor_whisper:      'A voice whispers something close to your ear',
        scare_light_flicker:       'The lights flicker violently then go out for three seconds',
        scare_cabinet_door:        'A cabinet door swings open violently',
    };

    const description = scareDescriptions[scareKey] || 'Something moves in the darkness';

    try {
        const response = await client.messages.create({
            model:      'claude-sonnet-4-20250514',
            max_tokens: 60,
            messages:   [{
                role:    'user',
                content: `Write ONE chilling sentence (max 15 words) for this jump scare moment in a murder mystery game called "${caseTitle}". The scare: "${description}". Make it visceral and atmospheric, present tense. No dialogue.`,
            }],
        });

        return response.content[0]?.text?.trim() || '';
    } catch {
        return ''; // Scare still plays visually/audio — a text is optional
    }
}

// ─────────────────────────────────────────────
//  TWIST NARRATION ENHANCEMENT
// ─────────────────────────────────────────────

/**
 * Take a scripted twist text and make it dynamic based on player progress.
 * E.g., if the player already suspected the culprit, the narration acknowledges it.
 */
async function enhanceTwistNarration(baseNarration, playerContext) {
    const { wrongAccusations, cluesFound, sessionDuration } = playerContext;

    try {
        const response = await client.messages.create({
            model:      'claude-sonnet-4-20250514',
            max_tokens: 300,
            messages:   [{
                role:    'user',
                content: `You are a noir narrator in a murder mystery game. Deliver this case revelation in a cinematic, tense style. Keep the same facts but make it gripping. Max 3 short paragraphs.

Original text: "${baseNarration}"

Player context: They have been investigating for ${Math.round(sessionDuration / 60)} minutes, found ${cluesFound} clues, and made ${wrongAccusations} wrong accusations. Subtly reflect this in the tone (more desperate if many wrong accusations, more confident if they've found many clues).`,
            }],
        });

        return response.content[0]?.text || baseNarration;
    } catch {
        return baseNarration;
    }
}

module.exports = {
    generateSuspectDialogue,
    generateJumpScareText,
    enhanceTwistNarration,
};