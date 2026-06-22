import 'package:flutter/material.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class WalletPaymentMethodsPage extends StatefulWidget {
  const WalletPaymentMethodsPage({super.key});

  @override
  State<WalletPaymentMethodsPage> createState() => _WalletPaymentMethodsPageState();
}

class _WalletPaymentMethodsPageState extends State<WalletPaymentMethodsPage> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final Map<String, dynamic> response = await AppSession.instance.walletMethods();
    return (response['items'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
  }

  Future<void> _refresh() async {
    final Future<List<Map<String, dynamic>>> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  Future<void> _setDefault(String id) async {
    await AppSession.instance.setDefaultWalletMethod(id);
    await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Wallet',
      subtitle: 'Saved payment methods and default billing choices',
      showBack: true,
      showNavigation: false,
      child: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<List<Map<String, dynamic>>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) return Padding(padding: const EdgeInsets.all(24), child: PatientEmptyState(title: 'Unable to load wallet', body: snapshot.error.toString(), icon: Icons.account_balance_wallet_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry'))));
          final List<Map<String, dynamic>> methods = snapshot.data ?? <Map<String, dynamic>>[];
          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            children: <Widget>[
              PatientHeroCard(badge: '${methods.length} methods', title: 'Billing that stays ready for every visit', subtitle: 'Manage saved cards and set the default payment method for faster checkout.'),
              const SizedBox(height: 18),
              ...methods.map((Map<String, dynamic> item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: PatientCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                    Row(children: <Widget>[
                      Expanded(child: Text('${item['brand'] ?? 'Card'} •••• ${item['last4'] ?? ''}', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700))),
                      if (item['isDefault'] == true) const PatientStatusBadge(label: 'DEFAULT'),
                    ]),
                    const SizedBox(height: 8),
                    Text(item['label']?.toString() ?? item['type']?.toString() ?? 'Saved method'),
                    const SizedBox(height: 12),
                    Align(alignment: Alignment.centerRight, child: FilledButton.tonal(onPressed: item['isDefault'] == true ? null : () => _setDefault(item['id']?.toString() ?? ''), child: const Text('Set default'))),
                  ]),
                ),
              )),
            ],
          );
        },
      ),
    );
  }
}
