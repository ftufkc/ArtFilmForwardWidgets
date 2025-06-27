/**
 * @file cc.js
 * @description Forward widget for browsing the Criterion Collection.
 * Fetches the master list from arrismo/criterioncollection and enriches it with metadata from TMDB.
 */

// 1. Widget Metadata: Defines the widget's properties and entry points for the Forward app.
var WidgetMetadata = {
    "id": "criterion_collection",
    "title": "Criterion Collection",
    "description": "浏览完整的标准收藏(CC)电影列表，并从TMDB获取封面和详情。",
    "author": "Your Name", // 请替换为您的名字
    "version": "1.0.0",
    "requiredVersion": "0.0.1",
    "detailCacheDuration": 3600, // 详情缓存1小时
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
const ITEMS_PER_PAGE = 20; // 每页显示的项目数量
const CRITERION_DATA_URL = 'https://raw.githubusercontent.com/arrismo/criterioncollection/master/data-raw/criterion_collection.json';
const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';

// 3. Global Cache Variables: To store fetched data and avoid redundant API calls.
let criterionList =; // 缓存 Criterion Collection 完整列表
let tmdbConfig = null; // 缓存 TMDB API 配置 (如图片基础URL)

/**
 * 主函数，由 Forward 框架根据 WidgetMetadata 中的配置调用。
 * @param {object} params - 框架传递的参数，包含 { page: number }。
 * @returns {Promise<Array<object>>} - 返回一个符合 Forward 数据模型的对象数组。
 */
async function getCollectionPage(params = {}) {
    try {
        // 步骤 1: 确保基础数据已加载和缓存
        await fetchAndCacheCriterionData();
        await fetchAndCacheTmdbConfig();

        // 步骤 2: 实现分页逻辑
        const page = params.page |
            | 1;
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageItems = criterionList.slice(startIndex, endIndex);

        // 步骤 3: 使用 TMDB 数据丰富当前页的项目
        const enrichedItems = await enrichItemsWithTmdb(pageItems);

        // 步骤 4: 将丰富后的数据映射为 Forward 框架所需的最终格式
        return mapToForwardDataModel(enrichedItems);

    } catch (error) {
        console.error("处理 Criterion Collection 列表失败:", error);
        // 在出错时可以返回一个错误提示
        return [{
            id: 'error',
            type: 'movie',
            title: '加载失败',
            description: `无法加载 Criterion Collection 数据。请检查网络连接或稍后重试。\n错误详情: ${error.message}`
        }];
    }
}

/**
 * 辅助函数：获取并缓存 Criterion Collection 的完整电影列表。
 * 如果列表已在缓存中，则直接返回。
 */
async function fetchAndCacheCriterionData() {
    if (criterionList.length > 0) {
        return; // 数据已缓存，无需再次获取
    }
    console.log("正在获取 Criterion Collection 数据...");
    const response = await Widget.http.get(CRITERION_DATA_URL);
    criterionList = JSON.parse(response.data);
    console.log(`成功获取并缓存了 ${criterionList.length} 部 Criterion 电影。`);
}

/**
 * 辅助函数：获取并缓存 TMDB API 的配置信息。
 * 主要用于获取图片 URL 的基础路径和可用尺寸。
 */
async function fetchAndCacheTmdbConfig() {
    if (tmdbConfig) {
        return; // 配置已缓存
    }
    if (!TMDB_API_KEY |
        | TMDB_API_KEY === 'YOUR_API_KEY_HERE') {
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
    // 为每个项目创建一个 TMDB 搜索的 Promise
    const promises = items.map(item => {
        const query = encodeURIComponent(item.title);
        const year = item.year;
        const url = `${TMDB_API_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${query}&primary_release_year=${year}&language=zh-CN`;

        return Widget.http.get(url).then(response => {
            const searchResults = JSON.parse(response.data);
            // 如果找到结果，则取第一个作为最佳匹配
            if (searchResults && searchResults.results && searchResults.results.length > 0) {
                return {...item, tmdbData: searchResults.results };
            }
            // 如果未找到，则返回原始项目，tmdbData 为 null
            return {...item, tmdbData: null };
        }).catch(error => {
            console.error(`为 "${item.title}" 获取 TMDB 数据失败:`, error);
            // 即使单个请求失败，也返回原始项目，保证健壮性
            return {...item, tmdbData: null };
        });
    });

    // 并发执行所有请求
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
            // 如果有 TMDB 数据，则构建封面 URL，否则为 null
            coverUrl: tmdb && tmdb.poster_path? `${imageBaseUrl}${posterSize}${tmdb.poster_path}` : null,
            posterPath: tmdb && tmdb.poster_path? `${imageBaseUrl}${posterSize}${tmdb.poster_path}` : null,
            backdropPath: tmdb && tmdb.backdrop_path? `${imageBaseUrl}${backdropSize}${tmdb.backdrop_path}` : null,
            releaseDate: item.year.toString(),
            mediaType: 'movie',
            rating: tmdb? tmdb.vote_average.toFixed(1) : 'N/A', // 保留一位小数
            description: `导演: ${item.director}\n国家: ${item.country}\nCC 编号: ${item.spine_number}\n\n${tmdb? tmdb.overview : '暂无简介。'}`,
            // 可以根据需要添加更多字段
        };
    });
}