use base64::{engine::general_purpose::STANDARD, Engine as _};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

fn default_photo_position() -> f64 {
    50.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatMember {
    id: String,
    #[serde(default)]
    serial_number: String,
    #[serde(default)]
    photo: String,
    #[serde(default = "default_photo_position")]
    photo_position_x: f64,
    #[serde(default = "default_photo_position")]
    photo_position_y: f64,
    #[serde(default)]
    name: String,
    #[serde(default)]
    adoption_status: String,
    #[serde(default)]
    gender: String,
    #[serde(default)]
    coat_color: String,
    #[serde(default)]
    age: String,
    #[serde(default)]
    vaccine_status: String,
    #[serde(default)]
    neutered: String,
    #[serde(default)]
    last_vaccine_date: String,
    #[serde(default)]
    adoption_date: String,
    #[serde(default)]
    adoption_agreement_text: String,
    #[serde(default)]
    adoption_agreement_image: String,
    #[serde(default)]
    rehoming_date: String,
    #[serde(default)]
    adopter: String,
    #[serde(default)]
    contact: String,
    #[serde(default)]
    cage_fee: Option<f64>,
    #[serde(default)]
    fee_due_date: String,
    #[serde(default)]
    status: String,
    #[serde(default)]
    floor: String,
    #[serde(default)]
    area: String,
    #[serde(default)]
    cage_number: String,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    created_at: String,
    #[serde(default)]
    deleted_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatMemberDataFile {
    #[serde(default = "default_schema_version")]
    schema_version: u32,
    #[serde(default)]
    records: Vec<CatMember>,
}

fn default_schema_version() -> u32 {
    4
}

fn application_root() -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or("无法确定项目目录")?
        .to_path_buf();

    #[cfg(not(debug_assertions))]
    let root = std::env::current_exe()
        .map_err(|error| error.to_string())?
        .parent()
        .ok_or("无法确定程序目录")?
        .to_path_buf();

    Ok(root)
}

fn database_path() -> Result<PathBuf, String> {
    Ok(application_root()?
        .join("本地数据")
        .join("业务数据")
        .join("猫爪数据.db"))
}

fn photo_directory() -> Result<PathBuf, String> {
    Ok(application_root()?.join("本地数据").join("猫咪照片"))
}

fn adoption_agreement_directory() -> Result<PathBuf, String> {
    Ok(application_root()?.join("本地数据").join("领养协议"))
}

fn ensure_column(
    connection: &Connection,
    column_name: &str,
    column_definition: &str,
) -> Result<(), String> {
    let exists: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('cat_members') WHERE name = ?1",
            [column_name],
            |row| row.get(0),
        )
        .map_err(|error| format!("数据库结构检查失败: {error}"))?;
    if exists == 0 {
        connection
            .execute(
                &format!("ALTER TABLE cat_members ADD COLUMN {column_definition}"),
                [],
            )
            .map_err(|error| format!("数据库字段升级失败: {error}"))?;
    }
    Ok(())
}

fn create_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS cat_members (
                id TEXT PRIMARY KEY NOT NULL,
                photo TEXT NOT NULL DEFAULT '',
                photo_position_x REAL NOT NULL DEFAULT 50,
                photo_position_y REAL NOT NULL DEFAULT 50,
                name TEXT NOT NULL DEFAULT '',
                adoption_status TEXT NOT NULL DEFAULT '',
                gender TEXT NOT NULL DEFAULT '',
                coat_color TEXT NOT NULL DEFAULT '',
                age TEXT NOT NULL DEFAULT '',
                vaccine_status TEXT NOT NULL DEFAULT '',
                neutered TEXT NOT NULL DEFAULT '',
                last_vaccine_date TEXT NOT NULL DEFAULT '',
                adoption_date TEXT NOT NULL DEFAULT '',
                rehoming_date TEXT NOT NULL DEFAULT '',
                adopter TEXT NOT NULL DEFAULT '',
                contact TEXT NOT NULL DEFAULT '',
                cage_fee REAL,
                fee_due_date TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT '',
                floor TEXT NOT NULL DEFAULT '',
                area TEXT NOT NULL DEFAULT '',
                cage_number TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT '',
                deleted_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_cat_members_deleted_at ON cat_members(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_cat_members_name ON cat_members(name);",
        )
        .map_err(|error| format!("数据库初始化失败: {error}"))?;
    ensure_column(connection, "serial_number", "serial_number TEXT NOT NULL DEFAULT ''")?;
    ensure_column(
        connection,
        "adoption_agreement_text",
        "adoption_agreement_text TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(
        connection,
        "adoption_agreement_image",
        "adoption_agreement_image TEXT NOT NULL DEFAULT ''",
    )?;
    Ok(())
}

fn upsert_member(connection: &Connection, member: &CatMember) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO cat_members (
                id, photo, photo_position_x, photo_position_y, name, adoption_status,
                gender, coat_color, age, vaccine_status, neutered, last_vaccine_date,
                adoption_date, rehoming_date, adopter, contact, cage_fee, fee_due_date,
                status, floor, area, cage_number, notes, created_at, deleted_at,
                serial_number, adoption_agreement_text, adoption_agreement_image
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
                ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25,
                ?26, ?27, ?28
            ) ON CONFLICT(id) DO UPDATE SET
                photo=excluded.photo,
                photo_position_x=excluded.photo_position_x,
                photo_position_y=excluded.photo_position_y,
                name=excluded.name,
                adoption_status=excluded.adoption_status,
                gender=excluded.gender,
                coat_color=excluded.coat_color,
                age=excluded.age,
                vaccine_status=excluded.vaccine_status,
                neutered=excluded.neutered,
                last_vaccine_date=excluded.last_vaccine_date,
                adoption_date=excluded.adoption_date,
                rehoming_date=excluded.rehoming_date,
                adopter=excluded.adopter,
                contact=excluded.contact,
                cage_fee=excluded.cage_fee,
                fee_due_date=excluded.fee_due_date,
                status=excluded.status,
                floor=excluded.floor,
                area=excluded.area,
                cage_number=excluded.cage_number,
                notes=excluded.notes,
                created_at=excluded.created_at,
                deleted_at=excluded.deleted_at,
                serial_number=excluded.serial_number,
                adoption_agreement_text=excluded.adoption_agreement_text,
                adoption_agreement_image=excluded.adoption_agreement_image",
            params![
                member.id,
                member.photo,
                member.photo_position_x,
                member.photo_position_y,
                member.name,
                member.adoption_status,
                member.gender,
                member.coat_color,
                member.age,
                member.vaccine_status,
                member.neutered,
                member.last_vaccine_date,
                member.adoption_date,
                member.rehoming_date,
                member.adopter,
                member.contact,
                member.cage_fee,
                member.fee_due_date,
                member.status,
                member.floor,
                member.area,
                member.cage_number,
                member.notes,
                member.created_at,
                member.deleted_at,
                member.serial_number,
                member.adoption_agreement_text,
                member.adoption_agreement_image,
            ],
        )
        .map_err(|error| format!("成员数据保存失败: {error}"))?;
    Ok(())
}

fn decode_photo_data(data_url: &str) -> Result<(&'static str, Vec<u8>), String> {
    let (metadata, encoded) = data_url
        .split_once(',')
        .ok_or("照片数据格式无效")?;
    let extension = if metadata.starts_with("data:image/jpeg") {
        "jpg"
    } else if metadata.starts_with("data:image/png") {
        "png"
    } else if metadata.starts_with("data:image/webp") {
        "webp"
    } else {
        return Err("仅支持 JPG、PNG 和 WebP 照片".into());
    };
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|error| format!("照片解码失败: {error}"))?;
    Ok((extension, bytes))
}

fn persist_photo(member_id: &str, data_url: &str) -> Result<String, String> {
    let (extension, bytes) = decode_photo_data(data_url)?;
    let directory = photo_directory()?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let safe_id: String = member_id
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '-')
        .collect();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let filename = format!("猫咪-{}-{}.{}", safe_id, timestamp, extension);
    let target = directory.join(&filename);
    let temporary = directory.join(format!(".{filename}.tmp"));
    fs::write(&temporary, bytes).map_err(|error| format!("照片写入失败: {error}"))?;
    fs::rename(&temporary, &target).map_err(|error| format!("照片保存失败: {error}"))?;
    Ok(format!("本地数据/猫咪照片/{filename}"))
}

fn persist_adoption_agreement_image(member_id: &str, data_url: &str) -> Result<String, String> {
    let (extension, bytes) = decode_photo_data(data_url)?;
    let directory = adoption_agreement_directory()?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let safe_id: String = member_id
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '-')
        .collect();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let filename = format!("领养协议-{}-{}.{}", safe_id, timestamp, extension);
    let target = directory.join(&filename);
    let temporary = directory.join(format!(".{filename}.tmp"));
    fs::write(&temporary, bytes).map_err(|error| format!("领养协议写入失败: {error}"))?;
    fs::rename(&temporary, &target).map_err(|error| format!("领养协议保存失败: {error}"))?;
    Ok(format!("本地数据/领养协议/{filename}"))
}

fn open_database() -> Result<Connection, String> {
    let path = database_path()?;
    let directory = path.parent().ok_or("数据库目录无效")?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let connection = Connection::open(path).map_err(|error| format!("数据库打开失败: {error}"))?;
    create_schema(&connection)?;
    Ok(connection)
}

#[tauri::command]
fn load_cat_members() -> Result<CatMemberDataFile, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare(
            "SELECT id, photo, photo_position_x, photo_position_y, name, adoption_status,
                gender, coat_color, age, vaccine_status, neutered, last_vaccine_date,
                adoption_date, rehoming_date, adopter, contact, cage_fee, fee_due_date,
                status, floor, area, cage_number, notes, created_at, deleted_at,
                serial_number, adoption_agreement_text, adoption_agreement_image
             FROM cat_members ORDER BY CAST(id AS INTEGER), id",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(CatMember {
                id: row.get(0)?,
                serial_number: row.get(25)?,
                photo: row.get(1)?,
                photo_position_x: row.get(2)?,
                photo_position_y: row.get(3)?,
                name: row.get(4)?,
                adoption_status: row.get(5)?,
                gender: row.get(6)?,
                coat_color: row.get(7)?,
                age: row.get(8)?,
                vaccine_status: row.get(9)?,
                neutered: row.get(10)?,
                last_vaccine_date: row.get(11)?,
                adoption_date: row.get(12)?,
                adoption_agreement_text: row.get(26)?,
                adoption_agreement_image: row.get(27)?,
                rehoming_date: row.get(13)?,
                adopter: row.get(14)?,
                contact: row.get(15)?,
                cage_fee: row.get(16)?,
                fee_due_date: row.get(17)?,
                status: row.get(18)?,
                floor: row.get(19)?,
                area: row.get(20)?,
                cage_number: row.get(21)?,
                notes: row.get(22)?,
                created_at: row.get(23)?,
                deleted_at: row.get(24)?,
            })
        })
        .map_err(|error| error.to_string())?;
    let records = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(CatMemberDataFile {
        schema_version: 4,
        records,
    })
}

#[tauri::command]
fn upsert_cat_member(member: CatMember) -> Result<(), String> {
    upsert_member(&open_database()?, &member)
}

#[tauri::command]
fn import_cat_members(members: Vec<CatMember>) -> Result<(), String> {
    let mut connection = open_database()?;
    let transaction = connection.transaction().map_err(|error| error.to_string())?;
    for member in &members {
        upsert_member(&transaction, member)?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
fn soft_delete_cat_member(id: String, deleted_at: String) -> Result<(), String> {
    open_database()?
        .execute(
            "UPDATE cat_members SET deleted_at = ?1 WHERE id = ?2",
            params![deleted_at, id],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_cat_photo(member_id: String, data_url: String) -> Result<String, String> {
    persist_photo(&member_id, &data_url)
}

fn safe_photo_path(photo_path: &str) -> Result<PathBuf, String> {
    let filename = Path::new(photo_path)
        .file_name()
        .ok_or("照片路径无效")?;
    Ok(photo_directory()?.join(filename))
}

#[tauri::command]
fn load_cat_photo(photo_path: String) -> Result<String, String> {
    let path = safe_photo_path(&photo_path)?;
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("jpg")
        .to_ascii_lowercase();
    let mime = match extension.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        _ => "image/jpeg",
    };
    let bytes = fs::read(path).map_err(|error| format!("照片读取失败: {error}"))?;
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

#[tauri::command]
fn delete_cat_photo(photo_path: String) -> Result<(), String> {
    let path = safe_photo_path(&photo_path)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("照片删除失败: {error}"))?;
    }
    Ok(())
}

fn safe_adoption_agreement_path(image_path: &str) -> Result<PathBuf, String> {
    let filename = Path::new(image_path)
        .file_name()
        .ok_or("领养协议图片路径无效")?;
    Ok(adoption_agreement_directory()?.join(filename))
}

#[tauri::command]
fn save_adoption_agreement_image(member_id: String, data_url: String) -> Result<String, String> {
    persist_adoption_agreement_image(&member_id, &data_url)
}

#[tauri::command]
fn load_adoption_agreement_image(image_path: String) -> Result<String, String> {
    let path = safe_adoption_agreement_path(&image_path)?;
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("jpg")
        .to_ascii_lowercase();
    let mime = match extension.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        _ => "image/jpeg",
    };
    let bytes = fs::read(path).map_err(|error| format!("领养协议图片读取失败: {error}"))?;
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

#[tauri::command]
fn delete_adoption_agreement_image(image_path: String) -> Result<(), String> {
    let path = safe_adoption_agreement_path(&image_path)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("领养协议图片删除失败: {error}"))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_cat_members,
            upsert_cat_member,
            import_cat_members,
            soft_delete_cat_member,
            save_cat_photo,
            load_cat_photo,
            delete_cat_photo,
            save_adoption_agreement_image,
            load_adoption_agreement_image,
            delete_adoption_agreement_image
        ])
        .run(tauri::generate_context!())
        .expect("启动猫爪猫咪管理后台失败");
}
