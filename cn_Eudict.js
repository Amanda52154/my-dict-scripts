class cn_Eudict {
  async displayName() {
    return '自定义法语助手';
  }

  async findTerm(word) {
    return [{
      expression: word,
      reading: '',
      extrainfo: '',
      definitions: ['<div>这是一个测试翻译</div>'],
      audios: []
    }];
  }
}

window.cn_Eudict = cn_Eudict;
