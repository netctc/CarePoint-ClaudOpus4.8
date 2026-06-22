import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/app_session.dart';

class InvoicesRefundsPage extends StatefulWidget {
  const InvoicesRefundsPage({super.key});

  @override
  State<InvoicesRefundsPage> createState() => _InvoicesRefundsPageState();
}

class _InvoicesRefundsPageState extends State<InvoicesRefundsPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = AppSession.instance.payments();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Invoices & Refunds'), centerTitle: true),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) return Center(child: Text(snapshot.error.toString()));
          final List<dynamic> items = snapshot.data?['items'] as List<dynamic>? ?? <dynamic>[];
          return ListView.separated(
            padding: const EdgeInsets.all(24),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (BuildContext context, int index) {
              final Map<String, dynamic> item = items[index] as Map<String, dynamic>;
              return Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(item['service']?.toString() ?? 'Appointment payment', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                          const SizedBox(height: 4),
                          Text('${item['currency']} ${(int.parse(item['amountMinor'].toString()) / 100).toStringAsFixed(2)}'),
                        ],
                      ),
                    ),
                    Text(item['status']?.toString() ?? 'PENDING', style: TextStyle(color: item['status'] == 'CAPTURED' ? AppColors.success : AppColors.warning, fontWeight: FontWeight.w600)),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}
