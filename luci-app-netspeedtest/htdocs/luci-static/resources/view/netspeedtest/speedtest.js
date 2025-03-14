'use strict';
'require view';
'require poll';
'require dom';
'require fs';
'require rpc';
'require uci';
'require ui';
'require form';

const TestTimeout = 240 * 1000; // 4 Minutes

return view.extend({
//	handleSaveApply: null,
//	handleSave: null,
//	handleReset: null,

	load() {
	return Promise.all([
		L.resolveDefault(fs.stat('/usr/libexec/netspeedtest/speedtest'), {}),
		L.resolveDefault(fs.read('/var/speedtest_result'), null),
		L.resolveDefault(fs.stat('/var/speedtest_result'), {}),
		uci.load('netspeedtest')
	]);
	},

	poll_status(nodes, res) {
		const has_ookla = res[0].path;
		let result_content = res[1] ? res[1].trim().split("\n") : [];
		let ookla_stat = nodes.querySelector('#ookla_status');
		let result_stat = nodes.querySelector('#speedtest_result');
		if (has_ookla) {
			ookla_stat.style.color = 'green';
			dom.content(ookla_stat, [ _('Installed') ]);
		} else {
			ookla_stat.style.color = 'red';
			dom.content(ookla_stat, [ _('Not Installed') ]);
		};
		if (result_content.length) {
			if (result_content[0] == 'Testing') {
				result_stat.innerHTML = "<span style='color:yellow;font-weight:bold'>" +
					"<img src='" + L.resource(['icons/loading.gif']) + "' height='20' style='vertical-align:middle'>" +
					_('Testing in progress...') +
				"</span>";
			};
			if (result_content[0].match(/https?:\S+/)) {
				result_stat.innerHTML = "<div style='max-width:500px'><a href='" + result_content[0] + "' target='_blank'><img src='" + result_content[0] + '.png' + "' style='max-width:100%;max-height:100%;vertical-align:middle'></a></div>";
			};
			if (result_content[0] == 'Test failed') {
				result_stat.innerHTML = "<span style='color:red;font-weight:bold'>" + _('Test failed.') + "</span>";
			}
		} else {
			result_stat.innerHTML = "<span style='color:red;font-weight:bold;display:none'>" + _('No result.') + "</span>";
		};
		return;
	},

	render(res) {
		const has_ookla = res[0].path;
		const result_content = res[1] ? res[1].trim().split("\n") : [];
		const result_mtime = res[2] ? res[2].mtime * 1000 : 0;
		const date = new Date();

		let m, s, o;

		m = new form.Map('netspeedtest', _('Ookla SpeedTest'));

		s = m.section(form.TypedSection, '_result');
		s.anonymous = true;
		s.render = function (section_id) {
			if (result_content.length) {
				if (result_content[0] == 'Testing') {
					return E('div', { 'id': 'speedtest_result' }, [ E('span', { 'style': 'color:yellow;font-weight:bold' }, [
						E('img', { 'src': L.resource(['icons/loading.gif']), 'height': '20', 'style': 'vertical-align:middle' }, []),
						_('Testing in progress...')
					]) ])
				};
				if (result_content[0].match(/https?:\S+/)) {
					return E('div', { 'id': 'speedtest_result' }, [ E('div', { 'style': 'max-width:500px' }, [
						E('a', { 'href': result_content[0], 'target': '_blank' }, [
							E('img', { 'src': result_content[0] + '.png', 'style': 'max-width:100%;max-height:100%;vertical-align:middle' }, [])
					]) ]) ])
				};
				if (result_content[0] == 'Test failed') {
					return E('div', { 'id': 'speedtest_result' }, [ E('span', { 'style': 'color:red;font-weight:bold' }, [ _('Test failed.') ]) ])
				}
			} else {
				return E('div', { 'id': 'speedtest_result' }, [ E('span', { 'style': 'color:red;font-weight:bold;display:none' }, [ _('No result.') ]) ])
			}
		};

		s = m.section(form.NamedSection, 'config', 'netspeedtest');
		s.anonymous = true;

		o = s.option(form.Button, '_start', _('Start Test'));
		o.inputtitle = _('Start Test');
		o.inputstyle = 'apply';
		if (result_content.length && result_content[0] == 'Testing' && (date.getTime() - result_mtime) < TestTimeout)
			o.readonly = true;
		o.onclick = L.bind(function(ev, section_id) {
			const ookla_official=uci.get('netspeedtest', section_id, 'ookla_official') || '0'
			if (ookla_official === '1') {
				return fs.exec('/usr/lib/netspeedtest/speedtest')
					.then((res) => { return window.location = window.location.href.split('#')[0] })
					.catch((e) => { ui.addNotification(null, E('p', e.message), 'error') });
			} else {
				return fs.exec_direct('/usr/lib/netspeedtest/speedtest')
					.then((res) => { return window.location = window.location.href.split('#')[0] })
					.catch((e) => { ui.addNotification(null, E('p', e.message), 'error') });
			}
		}, o);

		o = s.option(form.DummyValue, '_ookla_status', _('Ookla® SpeedTest-CLI Status'));
		o.rawhtml = true;
		o.cfgvalue = function(s) {
			if (has_ookla) {
				return E('span', { 'id': 'ookla_status', 'style': 'color:green;font-weight:bold' }, [ _('Installed') ]);
			} else {
				return E('span', { 'id': 'ookla_status', 'style': 'color:red;font-weight:bold' }, [ _('Not Installed') ]);
			}
		};

		//o = s.option(form.Button, '_ookla_status', _('Ookla® SpeedTest-CLI Status'));
		//o.inputtitle = _('Not Installed');
		//o.inputstyle = 'null';
		//o.readonly = true;
		//o.onclick = function() {};
		//o.inputtitle = function() {
		//	if (has_ookla) {
		//		return _('Installed')
		//	} else {
		//		return _('Not Installed')
		//	}
		//};

		o = s.option(form.Flag, 'proxy_enabled', _('Enable proxy for downloader and test'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'proxy_protocol', _('Proxy Protocol'));
		o.value('http', 'HTTP');
		o.value('https', 'HTTPS');
		o.value('socks5', 'SOCKS5');
		o.value('socks5h', 'SOCKS5H');
		o.default = 'socks5';
		o.rmempty = false;
		o.retain = true;
		o.depends('proxy_enabled', '1');

		o = s.option(form.Value, 'proxy_server', _('Proxy Server'));
		o.datatype = "ipaddrport(1)";
		o.placeholder = '192.168.1.10:1080';
		o.rmempty = false;
		o.retain = true;
		o.depends('proxy_enabled', '1');

		o = s.option(form.Flag, 'ookla_official', _('Use Ookla® SpeedTest-CLI'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.ListValue, '_arch', _('System Arch'));
		o.value('i386');
		o.value('x86_64');
		o.value('armel');
		o.value('armhf');
		o.value('aarch64');
		o.default = 'x86_64';
		o.depends('ookla_official', '1');
		o.write = function() {};

		o = s.option(form.Button, '_download', _('Download Ookla® SpeedTest-CLI'));
		o.inputtitle = _('Download');
		o.inputstyle = 'apply';
		o.depends('ookla_official', '1');
		o.onclick = function(ev, section_id) {
			const arch=this.section.getOption('_arch').formvalue(section_id);
			//alert(arch);
			return fs.exec_direct('/etc/init.d/netspeedtest', ['download_ookla', arch])
				.catch((e) => { ui.addNotification(null, E('p', e.message), 'error') });
		}

		return m.render()
		.then(L.bind(function(m, nodes) {
			poll.add(L.bind(function() {
				return Promise.all([
					L.resolveDefault(fs.stat('/usr/libexec/netspeedtest/speedtest'), {}),
					L.resolveDefault(fs.read('/var/speedtest_result'), null)
				]).then(L.bind(this.poll_status, this, nodes));
			}, this), 5);
			return nodes;
		}, this, m));
	}
});
