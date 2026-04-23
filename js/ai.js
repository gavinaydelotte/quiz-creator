/* QuizForge — AI Integration (Anthropic Claude API) */
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
     * Generate flashcard pairs via Claude.
     * Requires the user's Anthropic API key stored in localStorage.
     * NOTE: Calling the API directly from a browser exposes the key in
     * DevTools — only use a key with a spend limit set for personal use.
     *
     * @param {string} topic   Natural-language topic description
     * @param {number} count   Number of cards to generate (3–20)
     * @returns {Promise<Array<{id:string, term:string, definition:string}>>}
     */
    generate: function (topic, count) {
      var key = this.getKey();
      if (!key) {
        return Promise.reject(
          new Error('No API key configured. Click ⚙ in the navbar to add your Anthropic API key.')
        );
      }

      var prompt = [
        'Generate exactly ' + count + ' flashcard pairs about: "' + topic + '".',
        '',
        'Return ONLY a valid JSON array — no explanation, no markdown, no other text:',
        '[{"term": "...", "definition": "..."}, ...]',
        '',
        'Requirements:',
        '- Terms must be specific and clear',
        '- Definitions must be concise (1–2 sentences max)',
        '- Cover diverse aspects of the topic',
        '- Be accurate and educational',
      ].join('\n');

      return fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
        .then(function (res) {
          if (!res.ok) {
            return res.json().catch(function () { return {}; }).then(function (err) {
              throw new Error((err.error && err.error.message) || ('API error ' + res.status));
            });
          }
          return res.json();
        })
        .then(function (data) {
          var text = data.content[0].text.trim();
          var match = text.match(/\[[\s\S]*\]/);
          if (!match) throw new Error('AI returned an unexpected format. Please try again.');

          var cards = JSON.parse(match[0]);
          if (!Array.isArray(cards)) throw new Error('Invalid response — expected an array.');

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
