[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](https://opensource.org/licenses/MIT)

# SingleStore Driver for SQLTools
![logo](icons/singlestore_logo_horizontal_color_on-white_rgb.png)

A Visual Studio Code extension which extends the [SQLTools extension](https://marketplace.visualstudio.com/items?itemName=mtxr.sqltools) to work with the SingleStore.

## Features
 - **Connect** to a SingleStoreDB instance
 - **Manage** connections in SQLTools Database Explorer 
 - **View** tables, views, columns, functions, procedures
 - **Generate** `INSERT` queries
 - **Autocomplete** SQL keywords, table and view names, column names, SingleStore built-in functions
 - **Run** SQL queries
 - **Export** SQL query results in CSV and JSON data formats

## Installation
Launch VS Code Quick Open (`Ctrl+P`), paste the following command, and press **Enter**.
```
ext install singlestore.sqltools-singlestore-driver
```

Alternatively, you can install this extension in the Visual Studio Code IDE from the **Extensions** tab. Press `Ctrl+Shift+X` by searching for `@tag:sqltools singlestore`.

## Usage
The following examples perform different tasks using the driver.
Refer to [SQLTools documentation](https://vscode-sqltools.mteixeira.dev/en/home/) for more information.

### Create a Connection
https://user-images.githubusercontent.com/55380838/221791339-c18f8539-8f01-45db-9c7d-94019923e869.mp4
> Note: The `Show records default limit` parameter specifies the maximum number of rows that are shown in the result.

### View tables and views
https://user-images.githubusercontent.com/55380838/221792568-a1345ca9-d44d-4e36-85a1-4311cc99327d.mp4

### Run a SQL query
https://user-images.githubusercontent.com/55380838/221792831-3f30c99b-ce27-4e0a-bb6e-6810718f6b10.mp4

### View and Edit Functions and Procedures
https://user-images.githubusercontent.com/55380838/221793272-31b14ad2-f9a1-49a8-8bff-cd7700eeae88.mp4
> Note: When creating a function or a procedure, you must change the delimiter to ensure that the function or procedure definition is correctly passed to the server as a single statement. The default delimiter is a semicolon (;). A problem arises when creating functions or procedures because they use semicolons as statement delimiters within the function body. Therefore, you must change the delimiter setting before creating your function or procedure, and then set it back to a semicolon after the alternate delimiter is no longer needed. Therefore, you must change the delimiter to something else (for example `//`) before creating your function or procedure, and then revert it to a semicolon (`;`) afterwards.
> The `DELIMITER` commands must be on independent lines. 

Here's an example:
``` 
DELIMITER //

CREATE OR REPLACE PROCEDURE courses_sp (course_code TEXT, section_number INT, number_students INT) AS
  DECLARE
    code TEXT = UCASE(course_code);
    num_students INT = number_students + 1;
  BEGIN
    INSERT INTO courses VALUES (code, section_number, num_students);
END //

DELIMITER ;
```

## Support and Feedback
If you have any questions, want to report a bug, or have a feature request please [open an issue](https://github.com/singlestore-labs/sqltools-singlestore-driver/issues/new).

## Setup development environment
1. Clone this repository, and open it in Visual Studio Code.
2. Run `npm install` to install all dependencies.
3. Run `npm run watch`.
4. Open the `extension.ts` file, and press F5. This opens a new Visual Studio Code window with a development version of the driver extension loaded.