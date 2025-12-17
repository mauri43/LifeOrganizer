const functions = require('firebase-functions/v2');
const { onCall } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const OpenAI = require('openai');

const OPENAI_ASSISTANT_ID = 'asst_bIrOvriI7gogR1Kgty6cvX0M';
const OPENAI_SECRET = defineSecret('OPENAI_API_KEY');
const OPENAI_POLL_INTERVAL_MS = 1500;
const OPENAI_MAX_POLLS = 20;
const CAPTION_SAMPLE_LIMIT = 5;
const CAPTION_CHAR_LIMIT = 1800;
const EMOJI_REGEX = /[\p{Extended_Pictographic}\uFE0F]/gu;
const HASHTAG_REGEX = /#[\p{L}\p{N}_-]+/gu;

function extractCaptionCandidatesFromJson(obj, results = []) {
  if (!obj || typeof obj !== 'object') {
    return results;
  }

  if (typeof obj.caption === 'string') {
    results.push(obj.caption);
  }
  if (typeof obj.captionText === 'string') {
    results.push(obj.captionText);
  }
  if (obj.node && typeof obj.node.text === 'string') {
    results.push(obj.node.text);
  }
  if (obj.edges && Array.isArray(obj.edges)) {
    obj.edges.forEach((edge) => extractCaptionCandidatesFromJson(edge, results));
  }
  if (Array.isArray(obj)) {
    obj.forEach((item) => extractCaptionCandidatesFromJson(item, results));
  } else {
    Object.values(obj).forEach((value) => extractCaptionCandidatesFromJson(value, results));
  }

  return results;
}

const INGREDIENT_HEADINGS = ['ingredients', 'ingredient list'];
const INSTRUCTION_HEADINGS = ['instructions', 'instruction', 'directions', 'direction', 'method', 'methods', 'steps', 'step'];
const ALL_SECTION_HEADINGS = [...INGREDIENT_HEADINGS, ...INSTRUCTION_HEADINGS];
const SECTION_SPLIT_REGEX = /(?:^|\n)\s*((?:ingredients?|ingredient list|instructions?|directions?|steps?|method)(?:\s+[\w\s]+)?)\s*[:\-–—]*\s*/gi;
const LINE_BREAK_REGEX = /(?:\r\n|\r|\n)+/;
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function normalizeLine(line) {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function captureSectionBlock(text, headings) {
  if (!text) return '';

  const headingsPattern = headings.map(escapeRegex).join('|');
  const allHeadingsPattern = ALL_SECTION_HEADINGS.map(escapeRegex).join('|');
  const sectionRegex = new RegExp(
    `(?:^|\\n)\\s*(?:${headingsPattern})(?:\\s+[^\\n]*)?\\s*[:\\-–—]?\\s*(?:\\n+|\\s+)([\\s\\S]*?)(?=\\n\\s*(?:${allHeadingsPattern})(?:\\s+[^\\n]*)?\\s*[:\\-–—]?\\s*|$)`,
    'i'
  );

  const match = sectionRegex.exec(text);
  if (!match || !match[1]) {
    return '';
  }

  return match[1];
}

function parseSectionLines(block) {
  if (!block) return [];

  return block
    .split(LINE_BREAK_REGEX)
    .map((line) => normalizeLine(line))
    .filter(Boolean);
}

function normalizeIngredientEntries(items) {
  if (!Array.isArray(items)) {
    if (!items) return [];
    if (typeof items === 'string') {
      return normalizeIngredientEntries(items.split(LINE_BREAK_REGEX));
    }
    return normalizeIngredientEntries([items]);
  }

  return items
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') {
        const name = normalizeLine(item);
        return name ? { name } : null;
      }
      if (typeof item === 'object') {
        const name =
          normalizeLine(item.name || item.ingredient || item.item || '') ||
          normalizeLine(item.text || '');
        if (!name) return null;
        const quantity = normalizeLine(item.quantity || item.amount || '');
        const unit = normalizeLine(item.unit || item.measure || '');
        return {
          name,
          quantity,
          unit,
        };
      }
      const name = normalizeLine(String(item));
      return name ? { name } : null;
    })
    .filter(Boolean);
}

function normalizeStepEntries(items) {
  if (!items) return [];

  if (typeof items === 'string') {
    return items
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(items)) {
    return normalizeStepEntries([items]);
  }

  return items
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') {
        return item.trim();
      }
      if (typeof item === 'object') {
        return (
          (item.step && String(item.step).trim()) ||
          (item.instruction && String(item.instruction).trim()) ||
          (item.text && String(item.text).trim()) ||
          ''
        );
      }
      return String(item).trim();
    })
    .filter(Boolean);
}

function selectValidUrl(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const value = String(candidate).trim();
    if (!value) continue;
    if (!/^https?:\/\//i.test(value)) continue;
    if (/example\.com/i.test(value)) continue;
    return value;
  }
  return '';
}

function splitSectionsLegacy(text) {
  if (!text) return null;

  const cleaned = text.replace(/\u00a0/g, ' ');
  const sections = [];

  let match;
  let lastIndex = 0;
  SECTION_SPLIT_REGEX.lastIndex = 0;

  while ((match = SECTION_SPLIT_REGEX.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      sections.push({
        heading: 'intro',
        content: cleaned.slice(lastIndex, match.index),
      });
    }
    const headingText = match[1] ? match[1].trim() : '';
    const canonicalHeading = headingText
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\s*[:\-–—]*$/, '');
    lastIndex = SECTION_SPLIT_REGEX.lastIndex;

    const nextMatch = SECTION_SPLIT_REGEX.exec(cleaned);
    const sectionContent = cleaned.slice(
      lastIndex,
      nextMatch ? nextMatch.index : undefined
    );

    const existingSectionIndex = sections.findIndex(
      (section) => section.heading === canonicalHeading
    );

    if (existingSectionIndex !== -1) {
      sections[existingSectionIndex].content += `\n${sectionContent}`;
    } else {
      sections.push({
        heading: canonicalHeading,
        content: sectionContent,
      });
    }

    if (nextMatch) {
      SECTION_SPLIT_REGEX.lastIndex = nextMatch.index;
    }
  }

  const trailing = cleaned.slice(lastIndex).trim();
  if (trailing) {
    if (
      sections.length === 0 ||
      (sections[sections.length - 1].heading !== 'intro' &&
        !INGREDIENT_HEADINGS.some((h) =>
          sections[sections.length - 1].heading.includes(h)
        ) &&
        !INSTRUCTION_HEADINGS.some((h) =>
          sections[sections.length - 1].heading.includes(h)
        ))
    ) {
      sections.push({
        heading: 'outro',
        content: trailing,
      });
    } else {
      sections[sections.length - 1].content += `\n${trailing}`;
    }
  }

  return sections;
}

function extractSectionsFromText(rawText) {
  if (!rawText) return null;

  const normalized = rawText
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) return null;

  const ingredientsBlock = captureSectionBlock(normalized, INGREDIENT_HEADINGS);
  const instructionsBlock = captureSectionBlock(normalized, INSTRUCTION_HEADINGS);

  let ingredients = parseSectionLines(ingredientsBlock);
  let instructions = parseSectionLines(instructionsBlock);
  let description = normalized.split('\n')[0]?.trim() || '';

  if (ingredients.length === 0 || instructions.length === 0) {
    const legacySections = splitSectionsLegacy(normalized);
    if (Array.isArray(legacySections) && legacySections.length > 0) {
      const legacyResult = {
        ingredients: [],
        instructions: [],
        description: '',
      };

      legacySections.forEach((section) => {
        const lines = parseSectionLines(section.content);
        if (lines.length === 0) return;

        if (!legacyResult.description && section.heading === 'intro') {
          legacyResult.description = lines.join(' ');
        }

        if (INGREDIENT_HEADINGS.some((h) => section.heading.includes(h))) {
          legacyResult.ingredients.push(...lines);
        } else if (
          INSTRUCTION_HEADINGS.some((h) => section.heading.includes(h))
        ) {
          legacyResult.instructions.push(...lines);
        }
      });

      if (ingredients.length === 0) {
        ingredients = legacyResult.ingredients;
      }
      if (instructions.length === 0) {
        instructions = legacyResult.instructions;
      }
      if (!description && legacyResult.description) {
        description = legacyResult.description;
      }
    }
  }

  if (ingredients.length === 0 && instructions.length === 0) {
    return null;
  }

  return {
    ingredients,
    instructions,
    description,
  };
}

function extractSectionsBySimpleHeadings(rawText) {
  if (!rawText) return null;

  const normalized = rawText
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) return null;

  const upper = normalized.toUpperCase();
  const ingredientsIndex = upper.indexOf('INGREDIENTS');
  const instructionsIndex = upper.indexOf('INSTRUCTIONS');

  let ingredientsBlock = '';
  let instructionsBlock = '';

  if (ingredientsIndex !== -1) {
    const start = ingredientsIndex + 'INGREDIENTS'.length;
    let end = upper.length;
    if (instructionsIndex !== -1 && instructionsIndex > ingredientsIndex) {
      end = instructionsIndex;
    }
    ingredientsBlock = normalized.slice(start, end);
  }

  if (instructionsIndex !== -1) {
    const start = instructionsIndex + 'INSTRUCTIONS'.length;
    let end = upper.length;
    const notesIndex = upper.indexOf('NOTES', start);
    if (notesIndex !== -1) {
      end = notesIndex;
    } else {
      const nextIngredientsIndex = upper.indexOf('INGREDIENTS', start);
      if (nextIngredientsIndex !== -1) {
        end = Math.min(end, nextIngredientsIndex);
      }
    }
    instructionsBlock = normalized.slice(start, end);
  }

  const ingredients = parseSectionLines(ingredientsBlock);
  const instructions = parseSectionLines(instructionsBlock);
  const description = normalized.split('\n')[0]?.trim() || '';

  if (ingredients.length === 0 && instructions.length === 0) {
    return null;
  }

  return {
    ingredients,
    instructions,
    description,
  };
}

function extractFirstStructuredCaption(captions) {
  if (!Array.isArray(captions)) return null;

  for (const caption of captions) {
    const parsed = extractSectionsFromText(caption);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeString(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(EMOJI_REGEX, '')
    .replace(HASHTAG_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeIngredientList(entries) {
  return normalizeIngredientEntries(entries)
    .map((entry) => ({
      name: sanitizeString(entry.name || ''),
      quantity: sanitizeString(entry.quantity || ''),
      unit: sanitizeString(entry.unit || ''),
    }))
    .filter((entry) => entry.name);
}

function sanitizeStepList(items) {
  return normalizeStepEntries(items)
    .map((step) => sanitizeString(step))
    .filter(Boolean);
}

function takeCaptionSamples(captions, fallback = '') {
  if (!Array.isArray(captions) || captions.length === 0) {
    return fallback ? [fallback.slice(0, CAPTION_CHAR_LIMIT)] : [];
  }

  return captions
    .slice(0, CAPTION_SAMPLE_LIMIT)
    .map((caption) => {
      if (!caption) return '';
      return caption.length > CAPTION_CHAR_LIMIT
        ? `${caption.slice(0, CAPTION_CHAR_LIMIT)}...`
        : caption;
    })
    .filter(Boolean);
}

function buildAssistantPrompt({ meta, structuredCaption, captions, fallbackCaption }) {
  const promptSections = [
    'Extract a structured recipe JSON object from the provided social caption data. Remove emojis and hashtags before returning the data. Respond with JSON only.',
    `Source URL: ${meta.sourceUrl}`,
  ];

  if (meta.ogTitle) {
    promptSections.push(`Meta title: ${meta.ogTitle}`);
  }
  if (meta.ogSiteName) {
    promptSections.push(`Source name: ${meta.ogSiteName}`);
  }

  if (structuredCaption) {
    promptSections.push('Structured caption candidate:');
    promptSections.push(JSON.stringify(structuredCaption, null, 2));
  }

  const samples = takeCaptionSamples(captions, fallbackCaption);
  if (samples.length > 0) {
    promptSections.push('Caption samples:');
    samples.forEach((sample, index) => {
      promptSections.push(`Caption ${index + 1}:\n${sample}`);
    });
  }

  return promptSections.join('\n\n');
}

function extractJsonFromAssistant(message) {
  if (!message || !Array.isArray(message.content)) {
    return null;
  }

  const combined = message.content
    .filter((part) => part.type === 'text' && part.text && part.text.value)
    .map((part) => part.text.value)
    .join('\n')
    .trim();

  if (!combined) return null;

  const codeBlockMatch = combined.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (codeBlockMatch ? codeBlockMatch[1] : combined).trim();

  try {
    return JSON.parse(candidate);
  } catch (err) {
    const jsonStart = candidate.indexOf('{');
    const jsonEnd = candidate.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      try {
        return JSON.parse(candidate.slice(jsonStart, jsonEnd + 1));
      } catch (nested) {
        functions.logger.error('Assistant JSON parse failed', nested);
      }
    } else {
      functions.logger.error('Assistant JSON parse failed', err);
    }
  }

  return null;
}

async function generateAssistantRecipe({
  client,
  meta,
  structuredCaption,
  candidateCaptions,
  fallbackCaption,
}) {
  const prompt = buildAssistantPrompt({
    meta,
    structuredCaption,
    captions: candidateCaptions,
    fallbackCaption,
  });

  const thread = await client.beta.threads.create({
    metadata: {
      source_url: (meta.sourceUrl || '').slice(0, 200),
    },
  });

  await client.beta.threads.messages.create(thread.id, {
    role: 'user',
    content: [
      {
        type: 'text',
        text: prompt,
      },
    ],
  });

  let run = await client.beta.threads.runs.create(thread.id, {
    assistant_id: OPENAI_ASSISTANT_ID,
  });

  let attempts = 0;
  while (
    attempts < OPENAI_MAX_POLLS &&
    (run.status === 'queued' || run.status === 'in_progress')
  ) {
    await sleep(OPENAI_POLL_INTERVAL_MS);
    run = await client.beta.threads.runs.retrieve(thread.id, run.id);
    attempts += 1;
  }

  if (run.status !== 'completed') {
    throw new Error(`Assistant run did not complete (status=${run.status})`);
  }

  const messages = await client.beta.threads.messages.list(thread.id, {
    limit: 5,
  });

  const assistantMessage = messages.data.find(
    (msg) => msg.role === 'assistant'
  );

  if (!assistantMessage) {
    throw new Error('Assistant completed with no response message');
  }

  return extractJsonFromAssistant(assistantMessage);
}

function buildRecipeFromAssistantPayload(payload, context) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const ingredientsSource =
    payload.ingredients ||
    payload.ingredient_list ||
    payload.ingredientLines ||
    [];
  const stepsSource =
    payload.steps || payload.instructions || payload.directions || [];

  const ingredients = sanitizeIngredientList(ingredientsSource);
  const steps = sanitizeStepList(stepsSource);

  if (ingredients.length === 0 || steps.length === 0) {
    return null;
  }

  const meta = context.meta || {};
  const structuredCaption = context.structuredCaption || null;

  const recipeTitle =
    sanitizeString(payload.title) ||
    sanitizeString(meta.ogTitle) ||
    sanitizeString(structuredCaption?.description) ||
    'Untitled Recipe';

  return {
    title: recipeTitle,
    sourceName: sanitizeString(payload.sourceName || meta.ogSiteName || ''),
    thumbnail: meta.thumbnail,
    videoUrl: meta.videoUrl,
    sourceUrl: meta.sourceUrl,
    description:
      sanitizeString(payload.description) ||
      sanitizeString(structuredCaption?.description) ||
      '',
    ingredients,
    steps,
    tags: Array.isArray(payload.tags)
      ? payload.tags.map((tag) => sanitizeString(tag)).filter(Boolean)
      : [],
    notes: sanitizeString(payload.notes || ''),
  };
}

exports.extractRecipe = onCall(
  {
    timeoutSeconds: 60,
    memory: '1GiB',
    region: 'us-central1',
    secrets: [OPENAI_SECRET],
  },
  async (request) => {
    const url = request.data && request.data.url;
    if (!url) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing recipe URL.');
    }

    functions.logger.info('extractRecipe invoked', { url });

    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      const dom = new JSDOM(response.data);
      const { document } = dom.window;

      const candidateCaptions = [];
      const rawCaptionEntries = [];
      const pushCaption = (value) => {
        if (!value) return;
        const raw = String(value);
        if (!raw.trim()) return;
        rawCaptionEntries.push(raw);
        const cleaned = raw
          .replace(/\r/g, '')
          .replace(/\t/g, ' ')
          .replace(/ +/g, ' ')
          .trim();
        if (cleaned) {
          candidateCaptions.push(cleaned);
        }
      };
      const metaSelectors = [
        'meta[property="og:description"]',
        'meta[name="description"]',
        'meta[property="twitter:description"]',
        'meta[name="twitter:description"]',
      ];

      const ogVideo =
        document.querySelector('meta[property="og:video"]')?.content ||
        document.querySelector('meta[property="og:video:secure_url"]')?.content ||
        '';
      const ogImage =
        document.querySelector('meta[property="og:image"]')?.content || '';
      const ogTitle =
        document.querySelector('meta[property="og:title"]')?.content || '';
      const ogSiteName =
        document.querySelector('meta[property="og:site_name"]')?.content || '';

      metaSelectors.forEach((selector) => {
        const el = document.querySelector(selector);
        if (el && el.content) {
          pushCaption(el.content);
        }
      });

      const scriptCaptionRegex = /"caption(?:Text|_text)?"\s*:\s*"([\s\S]*?)"/gi;
      const textNodeRegex = /"text"\s*:\s*"([\s\S]*?)"/gi;
      Array.from(document.querySelectorAll('script')).forEach((script) => {
        if (!script.textContent || script.textContent.length > 250000) return;

        let match;
        while ((match = scriptCaptionRegex.exec(script.textContent)) !== null) {
          const raw = match[1];
          const unescaped = raw
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
          pushCaption(unescaped);
        }

        let textMatch;
        while ((textMatch = textNodeRegex.exec(script.textContent)) !== null) {
          const raw = textMatch[1];
          if (raw.length > 2000) continue;
          const unescaped = raw
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
          if ((/ingredients/i.test(unescaped) || /instructions/i.test(unescaped)) && /[a-z]/i.test(unescaped)) {
            pushCaption(unescaped);
          }
        }

        const content = script.textContent.trim();
        try {
          if (content.startsWith('{') && content.endsWith('}')) {
            const json = JSON.parse(content);
            const possibleTexts = extractCaptionCandidatesFromJson(json);
            possibleTexts.forEach(pushCaption);
          } else {
            const additionalDataMatch = content.match(/window\.__additionalDataLoaded\([^,]+,(.*)\);?/s);
            if (additionalDataMatch) {
              const json = JSON.parse(additionalDataMatch[1]);
              const possibleTexts = extractCaptionCandidatesFromJson(json);
              possibleTexts.forEach(pushCaption);
            }
          }
        } catch (jsonErr) {
          // Ignore JSON parsing errors from unrelated scripts
        }
      });

      const uniqueCaptionText = Array.from(
        new Set(candidateCaptions.filter(Boolean))
      ).join('\n\n');

      const structuredCaption =
        extractFirstStructuredCaption(candidateCaptions) ||
        extractSectionsFromText(uniqueCaptionText) ||
        extractSectionsBySimpleHeadings(uniqueCaptionText);

      const bodyText = document.body.textContent.replace(/\s+/g, ' ').trim();
      const fallbackCaption =
        rawCaptionEntries[0] ||
        candidateCaptions[0] ||
        uniqueCaptionText ||
        bodyText ||
        '';

      const resolvedSourceUrl = selectValidUrl(url) || url;
      const resolvedVideoUrl =
        selectValidUrl(ogVideo, resolvedSourceUrl) || resolvedSourceUrl;
      const resolvedThumbnail = selectValidUrl(ogImage) || '';

      const hasIngredients =
        Array.isArray(structuredCaption?.ingredients) &&
        structuredCaption.ingredients.length > 0;
      const hasInstructions =
        Array.isArray(structuredCaption?.instructions) &&
        structuredCaption.instructions.length > 0;

      functions.logger.info('Caption extraction summary', {
        candidateCount: candidateCaptions.length,
        hasStructured: Boolean(structuredCaption),
        hasIngredients,
        hasInstructions,
      });

      const meta = {
        sourceUrl: resolvedSourceUrl,
        ogTitle,
        ogSiteName,
        thumbnail: resolvedThumbnail,
        videoUrl: resolvedVideoUrl,
        description: structuredCaption?.description || fallbackCaption || '',
      };

      let assistantRecipe = null;
      const apiKey = OPENAI_SECRET.value();

      if (apiKey) {
        const openaiClient = new OpenAI({ apiKey });
        try {
          functions.logger.info('Dispatching data to OpenAI assistant', {
            candidateCount: candidateCaptions.length,
          });
          const assistantPayload = await generateAssistantRecipe({
            client: openaiClient,
            meta,
            structuredCaption,
            candidateCaptions,
            fallbackCaption,
          });
          if (assistantPayload) {
            assistantRecipe = buildRecipeFromAssistantPayload(assistantPayload, {
              structuredCaption,
              meta,
            });
          } else {
            functions.logger.warn('Assistant returned an empty payload', {
              url,
            });
          }
        } catch (assistantErr) {
          functions.logger.error('OpenAI assistant call failed', assistantErr);
        }
      } else {
        functions.logger.warn('OPENAI_API_KEY secret unavailable at runtime');
      }

      if (assistantRecipe) {
        functions.logger.info('Returning assistant-generated recipe', {
          ingredientCount: assistantRecipe.ingredients.length,
          stepCount: assistantRecipe.steps.length,
        });
        return { recipe: assistantRecipe };
      }

      functions.logger.info('Falling back to heuristic parser', {
        hasIngredients,
        hasInstructions,
      });

      if (!hasIngredients || !hasInstructions) {
        return {
          manualEntryRequired: true,
          rawCaption: sanitizeString(fallbackCaption),
          suggestedTitle: sanitizeString(ogTitle || ''),
          suggestedDescription: sanitizeString(structuredCaption?.description || ''),
          sourceUrl: resolvedSourceUrl,
          videoUrl: resolvedVideoUrl,
          sourceName: sanitizeString(ogSiteName || ''),
          thumbnail: resolvedThumbnail,
        };
      }

      const description = structuredCaption?.description || '';
      const recipe = {
        title: sanitizeString(ogTitle || description || ''),
        sourceName: sanitizeString(ogSiteName || ''),
        thumbnail: resolvedThumbnail,
        videoUrl: resolvedVideoUrl,
        sourceUrl: resolvedSourceUrl,
        description: sanitizeString(description),
        ingredients: sanitizeIngredientList(structuredCaption?.ingredients || []),
        steps: sanitizeStepList(structuredCaption?.instructions || []),
        tags: [],
        notes: '',
      };

      return { recipe };
    } catch (err) {
      functions.logger.error('extractRecipe error', err);
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      throw new functions.https.HttpsError('internal', err.message || 'Extraction failed');
    }
  }
);