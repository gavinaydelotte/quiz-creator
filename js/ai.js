/* QuizForge — AI Integration (Google Gemini API) */
var AI = (function () {
  var KEY_STORE = 'qf-api-key';

  return {
    getKey: function () {
      return localStorage.getItem(KEY_STORE) || '';
    },

    setKey: function (key) {
      localStorage.setItem(KEY_STORE, key.trim());
    },

    /**
     * Generate flashcard pairs via Google Gemini.
     * Free tier: 1,500 requests/day, no credit card required.
     * Get a key at https://aistudio.google.com/
     *
     * @param {string} topic   Natural-language topic description
     * @param {number} count   Number of cards to generate (3–20)
     * @returns {Promise<Array<{id:string, term:string, definition:string}>>}
     */
    generate: function (topic, count) {
      var key = this.getKey();
      if (!key) {
        return Promise.reject(
          new Error('No API key set. Click "API Key" in the navbar to add your Google Gemini key.')
        );
      }

      var prompt = [
        'Generate exactly ' + count + ' flashcard pairs about: "' + topic + '".',
        '',
        'Return ONLY a valid JSON array — no explanation, no markdown fences, no other text:',
        '[{"term": "...", "definition": "..."}, ...]',
        '',
        'Requirements:',
        '- Terms must be specific and clear',
        '- Definitions must be concise (1–2 sentences max)',
        '- Cover diverse aspects of the topic',
        '- Be accurate and educational',
      ].join('\n');

      var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key='
        + encodeURIComponent(key);

      return fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      })
        .then(function (res) {
          if (!res.ok) {
            return res.json().catch(function () { return {}; }).then(function (err) {
              throw new Error(
                (err.error && err.error.message) || ('API error ' + res.status)
              );
            });
          }
          return res.json();
        })
        .then(function (data) {
          var part = data.candidates &&
                     data.candidates[0] &&
                     data.candidates[0].content &&
                     data.candidates[0].content.parts &&
                     data.candidates[0].content.parts[0];

          if (!part || !part.text) throw new Error('Empty response from Gemini. Please try again.');

          /* Strip markdown code fences if the model wrapped its output */
          var text = part.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

          var match = text.match(/\[[\s\S]*\]/);
          if (!match) throw new Error('Unexpected response format. Please try again.');

          var cards = JSON.parse(match[0]);
          if (!Array.isArray(cards)) throw new Error('Invalid response — expected a JSON array.');

          return cards
            .filter(function (c) { return c.term && c.definition; })
            .map(function (c, i) {
              return {
                id: 'ai-' + Date.now() + '-' + i,
                term: String(c.term).trim(),
                definition: String(c.definition).trim(),
              };
            });
        });
    },
  };
})();
