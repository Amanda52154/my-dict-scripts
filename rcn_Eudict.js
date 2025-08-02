class rcn_Eudict {
  async findTerm(word) {
    return [{ expression: word, reading: '', extrainfo: '', definitions: ['测试词典内容'], audios: [] }];
  }
}
