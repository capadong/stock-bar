const vscode = require('vscode');
const logger = require('./logger');
const { Configuration } = require('./configuration');
const { neteaseStockProvider } = require('./provider');
const { codeConvert } = require('./utils');
const { render } = require('./render');
const { timer } = require('./timer');

class Stock {
	constructor(code, alias) {
		this.code = codeConvert(code);
		this.symbol = code;
		this.name = null;
		this.alias = alias ?? '';
		this.price = 0;
		this.updown = 0;
		this.percent = 0;
		this.high = 0;
		this.low = 0;
		this.open = 0;
		this.yestclose = 0;
	}
	update(origin) {
		this.name = origin.name;
		this.price = origin.price;
		this.high = origin.high;
		this.low = origin.low;
		this.updown = origin.updown;
		this.percent = origin.percent;
		this.open = origin.open;
		this.yestclose = origin.yestclose;
	}
}

function loadChoiceStocks() {
	return Configuration.getStocks().map((v) => {
		if (typeof v === 'string') {
			return new Stock(v);
		}
		if (typeof v === 'object') {
			return new Stock(v.code, v.alias);
		}
		throw new Error(
			'配置格式错误, 查看 https://github.com/Chef5/stock-bar#配置',
		);
	});
}

exports.activate = function activate(context) {
	let stocks = loadChoiceStocks();

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(() => {
			stocks = loadChoiceStocks();
		}),
	);

	const task = async () => {
		try {
			// 从云端获取最新状态
			logger.debug('call fetchData');
			const data = await neteaseStockProvider.fetch(stocks.map((v) => v.code));
			// 更新本地的数据
			for (const origin of data) {
				const stock = stocks.find((v) => v.code === origin.code);
				if (!stock) {
					continue;
				}
				stock.update(origin);
			}
			// 渲染内容
			logger.debug('render');
			render(stocks);
		} catch (e) {
			logger.error('%O', e);
		}

		// 阻塞等待下一个循环
		logger.debug('timer await');
		await timer.await();

		// 继续循环
		return task();
	};

	// 丢进宏任务队列
	setTimeout(task);
};

exports.deactivate = function deactivate() {};
