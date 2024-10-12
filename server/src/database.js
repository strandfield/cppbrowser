


const Database = require('better-sqlite3');

function checkTableExists(db, tableName) {
    let stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
    return stmt.get(tableName) != undefined;
}

module.exports = { 
    checkTableExists
};
