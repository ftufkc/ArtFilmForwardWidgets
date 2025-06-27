/**
 * @file cc.js
 * @description Forward widget for browsing the Criterion Collection.
 * Fetches the master list as a CSV from arrismo/criterioncollection and enriches it with metadata from TMDB.
 * @version 1.1.0
 */

// 1. Widget Metadata
var WidgetMetadata = {
    "id": "criterion_collection",
    "title": "Criterion Collection",
    "description": "浏览完整的标准收藏(CC)电影列表，并从TMDB获取封面和详情。",
    "author": "ddueh", // 请替换为您的名字
    "version": "1.1.0",
    "requiredVersion": "0.0.1",
    "detailCacheDuration": 3600,
    "modules": [{
        "title": "Criterion Collection 电影列表",
        "functionName": "getCollectionPage",
        "params": [{
            "key": "page",
            "type": "page",
            "title": "页码"
        }]
    }]
};

// 2. Configuration & Constants
//!!! 重要: 请在此处填入您自己的 TMDB API Key!!!
const TMDB_API_KEY = 'f74a7e719a0285a1da9013e73f76f236';
const ITEMS_PER_PAGE = 20;
// 已更新为正确的 CSV raw URL
const CRITERION_DATA_URL = 'https://raw.githubusercontent.com/arrismo/criterioncollection/main/data-raw/criterion.csv';
const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';

// 3. Global Cache Variables
let criterionList = []; // 初始化为一个空数组，缓存 Criterion Collection 完整列表
let tmdbConfig = null; // 缓存 TMDB API 配置

/**
 * 主函数，由 Forward 框架调用。
 * @param {object} params - 框架传递的参数，包含 { page: number }。
 * @returns {Promise<Array<object>>} - 返回一个符合 Forward 数据模型的对象数组。
 */
async function getCollectionPage(params = {}) {
    try {
        await fetchAndCacheCriterionData();
        await fetchAndCacheTmdbConfig();

        const page = params.page || 1;
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageItems = criterionList.slice(startIndex, endIndex);

        const enrichedItems = await enrichItemsWithTmdb(pageItems);
        return mapToForwardDataModel(enrichedItems);

    } catch (error) {
        console.error("处理 Criterion Collection 列表失败:", error);
        return [{
            id: 'error',
            type: 'movie',
            title: '加载失败',
            description: `无法加载 Criterion Collection 数据。请检查网络连接或稍后重试。\n错误详情: ${error.message}`
        }];
    }
}

/**
 * 辅助函数：获取、解析并缓存 Criterion Collection 的 CSV 电影列表。
 */
async function fetchAndCacheCriterionData() {
    if (criterionList.length > 0) {
        return; // 数据已缓存
    }
    console.log("正在获取 Criterion Collection CSV 数据...");
    const response = await Widget.http.get(CRITERION_DATA_URL);
    // 使用内置解析器处理 CSV 文本，并指定第一行为表头
    criterionList = parseCsv(response.data, { headers: true });
    console.log(`成功获取并缓存了 ${criterionList.length} 部 Criterion 电影。`);
}

/**
 * 辅助函数：获取并缓存 TMDB API 的配置信息。
 */
async function fetchAndCacheTmdbConfig() {
    if (tmdbConfig) {
        return; // 配置已缓存
    }
    if (!TMDB_API_KEY || TMDB_API_KEY === 'YOUR_API_KEY_HERE') {
        throw new Error("TMDB API Key 未配置。请在脚本中填写 TMDB_API_KEY。");
    }
    console.log("正在获取 TMDB API 配置...");
    const url = `${TMDB_API_BASE_URL}/configuration?api_key=${TMDB_API_KEY}`;
    const response = await Widget.http.get(url);
    tmdbConfig = JSON.parse(response.data);
    console.log("成功获取并缓存了 TMDB API 配置。");
}

/**
 * 辅助函数：使用 TMDB API 丰富电影项目列表。
 * @param {Array<object>} items - 从 Criterion 列表截取的当前页电影数组。
 * @returns {Promise<Array<object>>} - 返回附加了 TMDB 数据的新数组。
 */
async function enrichItemsWithTmdb(items) {
    const promises = items.map(item => {
        const query = encodeURIComponent(item.title);
        const year = item.year;
        const url = `${TMDB_API_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${query}&primary_release_year=${year}&language=zh-CN`;

        return Widget.http.get(url).then(response => {
            const searchResults = JSON.parse(response.data);
            if (searchResults && searchResults.results && searchResults.results.length > 0) {
                return {...item, tmdbData: searchResults.results[0] }; // 正确：返回数组的第一个元素
            }
            return {...item, tmdbData: null };
        }).catch(error => {
            console.error(`为 "${item.title}" 获取 TMDB 数据失败:`, error);
            return {...item, tmdbData: null };
        });
    });
    return Promise.all(promises);
}

/**
 * 辅助函数：将聚合后的数据映射为 Forward 框架的数据模型。
 * @param {Array<object>} enrichedItems - 包含 Criterion 和 TMDB 数据的电影数组。
 * @returns {Array<object>} - 符合 Forward 规范的对象数组。
 */
function mapToForwardDataModel(enrichedItems) {
    const imageBaseUrl = tmdbConfig.images.secure_base_url;

    return enrichedItems.map(item => {
        const tmdb = item.tmdbData;
        const posterSize = 'w500';
        const backdropSize = 'w780';

        return {
            id: `cc-${item.spine_number}`,
            type: 'movie',
            title: item.title,
            coverUrl: tmdb && tmdb.poster_path? `${imageBaseUrl}${posterSize}${tmdb.poster_path}` : null,
            posterPath: tmdb && tmdb.poster_path? `${imageBaseUrl}${posterSize}${tmdb.poster_path}` : null,
            backdropPath: tmdb && tmdb.backdrop_path? `${imageBaseUrl}${backdropSize}${tmdb.backdrop_path}` : null,
            releaseDate: item.year.toString(),
            mediaType: 'movie',
            rating: tmdb && tmdb.vote_average? tmdb.vote_average.toFixed(1) : 'N/A',
            description: `导演: ${item.director}\n国家: ${item.country}\nCC 编号: ${item.spine_number}\n\n${tmdb && tmdb.overview? tmdb.overview : '暂无简介。'}`,
        };
    });
}

/**
 * 一个简单的 CSV 解析函数
 * @param {string} str - 要解析的 CSV 字符串
 * @param {object} [opts={}] - 解析选项
 * @param {boolean} [opts.headers=false] - 第一行是否为表头。如果为 true，则返回对象数组。
 * @returns {Array<Array<string>>|Array<Object>}
 */
function parseCsv(str, opts = {}) {
    // 修正 #1: 初始化为空数组
    const arr = [];
    let quote = false;
    let row = 0, col = 0, c = 0;

    for (; c < str.length; c++) {
        const cc = str[c], nc = str[c + 1];

        // 修正 #2: 当行不存在时，初始化为空数组
        arr[row] = arr[row] || [];

        // 修正 #3: 当列不存在时，初始化为空字符串
        arr[row][col] = arr[row][col] || '';

        // 处理转义的双引号 ""
        if (cc === '"' && quote && nc === '"') {
            arr[row][col] += cc;
            ++c;
            continue;
        }

        // 处理普通的双引号
        if (cc === '"') {
            quote = !quote;
            continue;
        }

        // 处理逗号分隔符
        if (cc === ',' && !quote) {
            ++col;
            continue;
        }

        // 修正 #4: 处理换行符，使用正确的 || 操作符
        if ((cc === '\r' && nc === '\n' && !quote) || (cc === '\n' && !quote) || (cc === '\r' && !quote)) {
            ++row;
            col = 0;
            // 如果是 \r\n，则多跳过一个字符
            if (cc === '\r' && nc === '\n') ++c;
            continue;
        }

        arr[row][col] += cc;
    }

    if (opts.headers) {
        // 逻辑修正: header 应该是第一行，rest 是剩余的行
        const header = arr[0];
        const dataRows = arr.slice(1);

        return dataRows.map(r => {
            return r.reduce((acc, v, i) => {
                // 使用 header 数组中的值作为 key
                const key = header[i] ? header[i].trim() : `col_${i}`;
                acc[key] = v ? v.trim() : '';
                return acc;
            }, {});
        });
    }

    return arr;
}

// 导出需要测试的函数
module.exports = {
    getCollectionPage,
    fetchAndCacheCriterionData,
    fetchAndCacheTmdbConfig,
    enrichItemsWithTmdb,
    mapToForwardDataModel,
    parseCsv,
    _private: { // 也可导出内部变量用于测试重置
        setCriterionList: (list) => { criterionList = list; },
        setTmdbConfig: (config) => { tmdbConfig = config; }
    }
};