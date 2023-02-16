import parse from './parse';

describe('query parse', () => {
    describe('handles comments', () => {
        it('-- comment', () => {
            let query = `select * from --comment a;a;a;a;a
            t`
            expect(parse(query)).toEqual([query]);
        })

        it('# comment', () => {
            let query = `select * from #comment a;a;a;a;a
            t`
            expect(parse(query)).toEqual([query]);
        })

        it('multiline comment', () => {
            let query = `select * from /* ;
            a;a;a;a;a
            a;a;a;a;a
            */ t`
            expect(parse(query)).toEqual([query]);
        })

        it('a lot of comments', () => {
            expect(parse(`select * from t;
            select -- a;a;a;a;a
            * from t;
            select # a;a;a;a;a
            * from t;
            select /* a;a;a;a;a
            a;a;a;a;a
            a;a;a;a;a */
            * from t;
            select * from t;`)).toEqual(
                [`select * from t`,
`
            select -- a;a;a;a;a
            * from t`,
`
            select # a;a;a;a;a
            * from t`,
`
            select /* a;a;a;a;a
            a;a;a;a;a
            a;a;a;a;a */
            * from t`,
`
            select * from t`]);
        })
    })

    describe('handles string literals', () => {
        it('\' escaped', () => {
            let query = "select 'a;\\'a;\"a;a'"
            expect(parse(query)).toEqual([query]);
        })
        it('" escaped', () => {
            let query = 'select "a;\'a;\\"a;a"'
            expect(parse(query)).toEqual([query]);
        })
        it('a lot of literals', () => {
            expect(parse("select 'a;\\'a;\"a;a';select \"a;'a;\\\"a;a\"")).toEqual(
                [
                    "select 'a;\\'a;\"a;a'", 
                    'select "a;\'a;\\"a;a"'
                ]);
        })
    })

    it('handles identifiers', () => {
        expect(parse('select `a;a;a;``a;a;a;` from t; select `a;a;a;``a;a;a;` from t;')).toEqual([
            'select `a;a;a;``a;a;a;` from t',
            ' select `a;a;a;``a;a;a;` from t'
        ])
    })

    it('handles delimiter change', () => {
        expect(parse(`CREATE TABLE courses(course_code TEXT, section_number INT, number_students INT);

        DELIMITER //
        
        CREATE OR REPLACE PROCEDURE courses_sp (course_code TEXT, section_number INT, number_students INT) AS
          DECLARE
            code TEXT = UCASE(course_code);
            num_students INT = number_students + 1;
          BEGIN
            INSERT INTO courses VALUES (code, section_number, num_students);
        END //
        
        DELIMITER ;
        
        SELECT * FROM courses;
        SELECT * FROM courses;
        `)).toEqual([
            `CREATE TABLE courses(course_code TEXT, section_number INT, number_students INT)`,
            `
        
        CREATE OR REPLACE PROCEDURE courses_sp (course_code TEXT, section_number INT, number_students INT) AS
          DECLARE
            code TEXT = UCASE(course_code);
            num_students INT = number_students + 1;
          BEGIN
            INSERT INTO courses VALUES (code, section_number, num_students);
        END `,
        `
        
        SELECT * FROM courses`,
        `
        SELECT * FROM courses`
        ])
    })
});
  