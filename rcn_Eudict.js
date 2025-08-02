class rcn_Eudict {
  constructor(options = {}) {
    this.options = options;
    this.maxexample = options.maxexample || 2;
  }

  // 获取节点文本
  T(node) {
    return node ? node.innerText.trim() : '';
  }

  // 删除指定选择器标签
  removeTags(elem, selector) {
    if (!elem) return;
    elem.querySelectorAll(selector).forEach(el => el.remove());
  }

  // 渲染CSS
  renderCSS() {
    return `
      <style>
        span.eg, span.exp, span.cara { display: block; }
        .cara { color: #1C6FB8; font-weight: bold; }
        .eg { color: #238E68; }
        span.cet {
          margin: 0 3px;
          padding: 0 3px;
          font-weight: normal;
          font-size: 0.8em;
          color: white;
          background-color: #5cb85c;
          border-radius: 3px;
        }
      </style>`;
  }

  // 请求前缀词条JSON
  async fetchPrefix(word) {
    const url = `https://www.frdic.com/dicts/prefix/${encodeURIComponent(word)}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) throw new Error(`请求失败: ${resp.status}`);
    return resp.json();
  }

  // 请求并解析详情页HTML
  async fetchAndParseDetail(url) {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) throw new Error(`详情请求失败: ${resp.status}`);
    const html = await resp.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const headsection = doc.querySelector('#dict-body > #exp-head');
    let expression = '';
    let reading = '';
    let extrainfo = '';
    let audios = [];

    if (headsection) {
      expression = this.T(headsection.querySelector('.word'));
      reading = this.T(headsection.querySelector('.Phonitic'));
      headsection.querySelectorAll('.tag').forEach(t => {
        extrainfo += `<span class="cet">${this.T(t)}</span>`;
      });
      const voiceElem = headsection.querySelector('.voice-js');
      if (voiceElem && voiceElem.dataset && voiceElem.dataset.rel) {
        audios.push('https://api.frdic.com/api/v2/speech/speakweb?' + voiceElem.dataset.rel);
      }
    }

    const content = doc.querySelector('#ExpFCchild') || doc.querySelector('#ExpSPECChild');
    if (!content) return null;

    this.removeTags(content, 'script');
    this.removeTags(content, '#word-thumbnail-image');
    this.removeTags(content, '[style]');
    if (content.parentNode) {
      this.removeTags(content.parentNode, '#ExpFCchild > br');
      this.removeTags(content.parentNode, '#ExpSPECChild > br');
    }

    content.querySelectorAll('a').forEach(anchor => {
      const href = anchor.getAttribute('href');
      if (href && !href.startsWith('http')) {
        anchor.setAttribute('href', 'https://www.frdic.com' + href);
      }
      anchor.setAttribute('target', '_blank');
    });

    content.innerHTML = content.innerHTML.replace(/<p class="exp">(.+?)<\/p>/gi, '<span class="exp">$1</span>');
    content.innerHTML = content.innerHTML.replace(/<span class="exp"><br>/gi, '<span class="exp">');
    content.innerHTML = content.innerHTML.replace(/<span class="eg"><br>/gi, '<span class="eg">');

    return {
      css: this.renderCSS(),
      expression,
      reading,
      extrainfo,
      definitions: [content.innerHTML],
      audios,
    };
  }

  // 主方法，查询词条
  async findTerm(word) {
    if (!word) return null;

    try {
      const terms = await this.fetchPrefix(word);
      if (!terms || terms.length === 0) return null;

      const filtered = terms.filter(t => t.value && t.recordid && t.recordtype !== 'CG').slice(0, this.maxexample);

      const promises = filtered.map(term => {
        const url = `https://www.frdic.com/dicts/fr/${term.value}?recordid=${term.recordid}`;
        return this.fetchAndParseDetail(url);
      });

      const results = await Promise.all(promises);
      return results.filter(r => r);
    } catch (err) {
      console.error('rcn_Eudict findTerm error:', err);
      return null;
    }
  }
}

// 将类挂载到window供插件识别（如果插件需要）
window.DictionaryClass = rcn_Eudict;

