/**
 *  Criterion Collection Widget
 *  ------------------------------------------------------------
 *  数据源   : https://github.com/arrismo/criterioncollection (criterion.csv)
 *  更新频率 : 30 天（≈2 592 000 s）
 *  Author   : <your name>
 *  ------------------------------------------------------------
 */

/* ============ Widget Metadata ============ */
WidgetMetadata = {
    id: "forward.criterion",
    title: "The Criterion Collection",
    version: "1.0.0",
    requiredVersion: "0.0.1",
    description:
        "基于 GitHub 数据集构建的 Criterion Collection 完整片单，每月自动刷新。",
    author: "ddueh",
    site: "https://github.com/arrismo/criterioncollection",
    modules: [
        {
            id: "list",
            title: "片单列表",
            functionName: "criterionList",
            cacheDuration: 2592000, // 30 days
            params: [
                {
                    name: "page",
                    title: "页码",
                    type: "page",
                },
                {
                    name: "pageSize",
                    title: "每页条数",
                    type: "input",
                    value: 20,
                    description: "默认 20 条，可自定义。",
                },
            ],
        },
    ],
};

/* ============ 常量 & 内存缓存 ============ */
const CSV_URL =
    "https://raw.githubusercontent.com/arrismo/criterioncollection/main/data-raw/criterion.csv";
let CRITERION_CACHE = null; // 同进程复用，减少解析

/* ============ 工具函数 ============ */
/** 解析一行 CSV → 字段数组（忽略首尾空格） */
function parseCsvLine(line) {
    const fields = [...line.matchAll(/"([^"]*)"/g)].map((m) => m[1].trim());
    return fields.length >= 5 ? fields : null;
}

/** 将 CSV 文本解析成对象数组 */
function parseCsv(text) {
    return text
        .trim()
        .split(/\n+/)
        .slice(1) // 跳过表头
        .map(parseCsvLine)
        .filter(Boolean)
        .map(([spine, year, country, title, director]) => ({
            spine: Number(spine),
            year,
            country,
            title,
            director,
        }))
        .filter((row) => !Number.isNaN(row.spine)); // 剔除异常行
}

/** 获取并缓存 Criterion CSV */
async function fetchCriterionData() {
    if (CRITERION_CACHE) return CRITERION_CACHE;

    const res = await Widget.http.get(CSV_URL, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (CriterionWidget/1.0; +https://github.com/InchStudio/ForwardWidgets)",
            Referer: "https://github.com/arrismo/criterioncollection",
        },
    });

    if (!res || !res.data) throw new Error("获取 Criterion CSV 失败");

    const list = parseCsv(res.data);

    // Spine 号去重，仅保留第一次出现
    const seen = new Set();
    CRITERION_CACHE = list.filter((item) => {
        if (seen.has(item.spine)) return false;
        seen.add(item.spine);
        return true;
    });

    return CRITERION_CACHE;
}

/* ============ 公开函数 ============ */
async function criterionList(params = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.max(1, Number(params.pageSize) || 20);
    const start = (page - 1) * pageSize;

    const data = await fetchCriterionData();
    const slice = data.slice(start, start + pageSize);

    return slice.map((item) => ({
        id: `criterion.${item.spine}`,
        type: "criterion",
        title: item.title,
        subtitle: `#${item.spine} · ${item.year} · ${item.country} · ${item.director}`,
        payload: item, // 全量信息，供前端使用
    }));
}
