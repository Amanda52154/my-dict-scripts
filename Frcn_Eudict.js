class frcn_Eudict {
  constructor(options = {}) {
    this.options = options;
    this.maxexample = options.maxexample || 2;
  }
  async displayName() {
    let locale = await api.locale();
    if (locale.indexOf('CN') != -1) return '自定义法语助手';
    if (locale.indexOf('TW') != -1) return '自定义法语助手';
    return 'Eudict FR1->CN Dictionary';
}
  // 简单文本获取辅助
  T(node) {
    return node ? node.innerText.trim() : '';
  }

  // 移除元素中指定标签
  removeTags(elem, selector) {
    if (!elem) return;
    elem.querySelectorAll(selector).forEach(el => el.remove());
  }

  // 渲染CSS样式，返回字符串
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

  // 发送请求获取词条前缀列表（JSON）
  async fetchPrefix(word) {
    const url = `https://www.frdic.com/dicts/prefix/${encodeURIComponent(word)}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) throw new Error(`请求失败: ${resp.status}`);
    return resp.json();
  }

  // 请求详情页HTML并解析释义
  async fetchAndParseDetail(url) {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) throw new Error(`详情请求失败: ${resp.status}`);
    const html = await resp.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 词头信息
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

    // 释义内容区 注意id大小写
    const content = doc.querySelector('#ExpFCchild') || doc.querySelector('#ExpSPECChild');
    if (!content) return null;

    // 清理无用标签
    this.removeTags(content, 'script');
    this.removeTags(content, '#word-thumbnail-image');
    this.removeTags(content, '[style]');
    if (content.parentNode) {
      this.removeTags(content.parentNode, '#ExpFCchild > br');
      this.removeTags(content.parentNode, '#ExpSPECChild > br');
    }

    // 修正超链接
    content.querySelectorAll('a').forEach(anchor => {
      const href = anchor.getAttribute('href');
      if (href && !href.startsWith('http')) {
        anchor.setAttribute('href', 'https://www.frdic.com' + href);
      }
      anchor.setAttribute('target', '_blank');
    });

    // 格式替换
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

  // 主查询入口，返回释义数组
  async findTerm(word) {
    if (!word) return null;

    try {
      const terms = await this.fetchPrefix(word);

      if (!terms || terms.length === 0) return null;

      // 过滤和限制数量
      const filtered = terms.filter(t => t.value && t.recordid && t.recordtype !== 'CG').slice(0, this.maxexample);

      // 并行拉取详情
      const promises = filtered.map(term => {
        const url = `https://www.frdic.com/dicts/fr/${term.value}?recordid=${term.recordid}`;
        return this.fetchAndParseDetail(url);
      });

      const results = await Promise.all(promises);
      return results.filter(r => r);

    } catch (err) {
      console.error(err);
      return null;
    }
  }
}

// 使用示例
(async () => {
  const dict = new frcn_Eudict({ maxexample: 2 });
  const results = await dict.findTerm('maison');
  console.log(results);
})();
