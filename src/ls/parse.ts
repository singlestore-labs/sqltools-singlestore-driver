/**
 * copied from https://github.com/mtxr/vscode-sqltools/blob/dev/packages/util/query/parse.ts
 * minor improvements
 */

class QueryParser {
  static parse(query: string): Array<string> {
    const queries: Array<string> = [];
    let restOfQuery = query;
    let delimiter: string = ';';
    while (true) {
      const statementAndRest = QueryParser.getStatements(restOfQuery, delimiter);

      const statement = statementAndRest.statement;
      if (statement != null && statement.trim() != '') {
        queries.push(statement);
      }

      restOfQuery = statementAndRest.rest;
      if (restOfQuery == null || restOfQuery.trim() == '') {
        break;
      }

      delimiter = statementAndRest.delimiter;
    }

    return queries;
  }

  static getStatements(query: string, delimiter: string): {statement: string, rest:string, delimiter:string} {
    let previousChar: string = null;
    let nextChar: string = null;
    let isInComment: boolean = false;
    let isInString: boolean = false;
    let isInIdentifier: boolean = false;
    let commentChar: string = null;
    let stringChar: string = null;
    const charArray: Array<string> = Array.from(query);

    let resultQueries: {statement: string, rest:string, delimiter:string} = null;
    for (let index = 0; index < charArray.length; index++) {
      let char = charArray[index];
      if (index > 0) {
        previousChar = charArray[index - 1];
      }

      if (index < charArray.length) {
        nextChar = charArray[index + 1];
      }

      // it's in string, go to next char
      if (previousChar != '\\' && (char == "'" || char == '"') && isInString == false && isInComment == false && isInIdentifier == false) {
        isInString = true;
        stringChar = char;
        continue;
      }

      // it's comment, go to next char
      if (
        (char == '#' || (char == '-' && nextChar == '-') || (char == '/' && nextChar == '*')) &&
        isInString == false &&
        isInComment == false &&
        isInIdentifier == false
      ) {
        isInComment = true;
        commentChar = char;
        if (char == '/' || char == '-') {
          index++;
        }
        continue;
      }

      // it's identifier, go to next char
      if(
        char == '`' && isInString == false && isInComment == false && isInIdentifier == false
      ) {
        isInIdentifier = true;
        continue;
      }

      // it's end of comment, go to next
      if (
        isInComment == true &&
        (((commentChar == '#' || commentChar == '-') && char == '\n') ||
          (commentChar == '/' && char == '*' && nextChar == '/'))
      ) {
        isInComment = false;
        commentChar = null;
        if (char == '*') {
          index++;
        }
        continue;
      }

      // string closed, go to next char
      if (previousChar != '\\' && char == stringChar && isInString == true) {
        isInString = false;
        stringChar = null;
        continue;
      }
      
      // identifier closed, go to next char
      if (char == '`' && isInIdentifier == true) {
        isInIdentifier = false;
        continue;
      }

      if (char.toLowerCase() == 'd' && isInComment == false && isInString == false && isInIdentifier == false) {
        const delimiterResult = QueryParser.getDelimiter(index, query);
        if (delimiterResult != null) {
          // it's delimiter
          const delimiterSymbol: string = delimiterResult.delimiterSymbol;
          const delimiterEndIndex: number = delimiterResult.delimiterEndIndex;
          query = query.substring(delimiterEndIndex);
          resultQueries = QueryParser.getStatements(query, delimiterSymbol);
          break;
        }
      }

      // it's a query, continue until you get delimiter hit
      if (
        (query.startsWith(delimiter, index)) &&
        isInString == false &&
        isInComment == false &&
        isInIdentifier == false
      ) {
        resultQueries = QueryParser.getQueryParts(query, index, delimiter);
        break;
      }
    }
    if (resultQueries == null) {
      if (query != null) {
        query = query.trim();
      }
      resultQueries = {
        statement: query,
        rest: null,
        delimiter: delimiter
      }
    }

    return resultQueries;
  }

  static getQueryParts(query: string, splittingIndex: number, delimiter:string): {statement: string, rest:string, delimiter:string} {
    let statement: string = query.substring(0, splittingIndex);
    const restOfQuery: string = query.substring(splittingIndex + delimiter.length);
    return {
      statement: statement,
      rest: restOfQuery,
      delimiter: delimiter
    };
  }

  static getDelimiter(index: number, query: string): {delimiterSymbol: string, delimiterEndIndex: number} {
    const delimiterKeyword = 'delimiter ';
    const delimiterLength = delimiterKeyword.length;
    let parsedQueryAfterIndex = query.substring(index);
    if (parsedQueryAfterIndex.toLowerCase().startsWith(delimiterKeyword)) {
      parsedQueryAfterIndex = parsedQueryAfterIndex.substring(delimiterLength)
      const whiteSpaceIndex = parsedQueryAfterIndex.search("\\s")
      let delimiterSymbol = whiteSpaceIndex == -1 ? parsedQueryAfterIndex :
        parsedQueryAfterIndex.substring(0, parsedQueryAfterIndex.search("\\s"));
      const delimiterSymbolEndIndex = index + delimiterLength + delimiterSymbol.length
      delimiterSymbol = delimiterSymbol.trim();
      if (delimiterSymbol != '') {
        return {
          delimiterSymbol: delimiterSymbol,
          delimiterEndIndex: delimiterSymbolEndIndex
        };
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
}

export default QueryParser.parse;
