import mysql from 'mysql2/promise';
import { config } from './config.js';

const dbName = config.db.database.replace(/[^a-zA-Z0-9_]/g, '');
if (!dbName) throw new Error('Invalid DB_NAME');

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: dbName,
  charset: 'utf8mb4',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      const conn = await mysql.createConnection({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
      });
      try {
        await conn.query(
          `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        );
      } finally {
        await conn.end();
      }
      return;
    } catch (err) {
      if (attempt === 40) {
        console.error(`[db] Could not reach MariaDB at ${config.db.host}:${config.db.port}.`);
        throw err;
      }
      await sleep(1500);
    }
  }
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL,
    name VARCHAR(80) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'Member',
    password_hash VARCHAR(255) NOT NULL,
    must_change_password TINYINT(1) NOT NULL DEFAULT 1,
    onboarded TINYINT(1) NOT NULL DEFAULT 0,
    tour_completed TINYINT(1) NOT NULL DEFAULT 0,
    theme VARCHAR(10) NOT NULL DEFAULT 'light',
    active TINYINT(1) NOT NULL DEFAULT 1,
    session_version INT NOT NULL DEFAULT 0,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_username (username),
    INDEX idx_users_active (active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS boards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    accent VARCHAR(20) NOT NULL DEFAULT '#7c8cff',
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS board_columns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT NOT NULL,
    name VARCHAR(80) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#64748b',
    position INT NOT NULL DEFAULT 0,
    wip_limit INT NULL,
    is_done TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_columns_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    INDEX idx_columns_board (board_id, position)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT NOT NULL,
    column_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'medium',
    due_date DATE NULL,
    assignee VARCHAR(80) NOT NULL DEFAULT '',
    position INT NOT NULL DEFAULT 0,
    archived TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cards_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    CONSTRAINT fk_cards_column FOREIGN KEY (column_id) REFERENCES board_columns(id) ON DELETE CASCADE,
    INDEX idx_cards_board (board_id, archived),
    INDEX idx_cards_column (column_id, position)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS labels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#7c8cff',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_labels_name (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS card_labels (
    card_id INT NOT NULL,
    label_id INT NOT NULL,
    PRIMARY KEY (card_id, label_id),
    CONSTRAINT fk_card_labels_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    CONSTRAINT fk_card_labels_label FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    card_id INT NOT NULL,
    user_id INT NULL,
    author_name VARCHAR(80) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comments_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_comments_card (card_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

export async function initDb() {
  await waitForServer();
  for (const statement of SCHEMA) {
    await pool.query(statement);
  }
  await pool.query('SELECT 1');
  console.log(`[db] Connected to MariaDB ${config.db.host}:${config.db.port}/${dbName}`);
}

export async function closeDb() {
  await pool.end();
}
