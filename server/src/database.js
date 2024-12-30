


// const Database = require('better-sqlite3');

function checkTableExists(db, tableName) {
    let stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
    return stmt.get(tableName) != undefined;
}

function checkColumnExists(databaseObject, tableName, columnName) {
    let stmt = databaseObject.prepare(`SELECT * FROM pragma_table_info('${tableName}') WHERE name=?`);
    return stmt.get(columnName) != undefined;
}

module.exports = { 
    checkTableExists,
    checkColumnExists
};
