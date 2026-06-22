import 'package:flutter/material.dart';

import '../../../../core/widgets/patient_ui.dart';

class ProviderOfflineQueuePage extends StatelessWidget {
  const ProviderOfflineQueuePage({super.key});

  @override
  Widget build(BuildContext context) {
    return const PatientScaffold(
      showNavigation: false,
      title: 'Offline actions',
      subtitle: 'Offline provider retry actions are not part of the patient mobile application.',
      child: _OfflineInfoBody(),
    );
  }
}

class _OfflineInfoBody extends StatelessWidget {
  const _OfflineInfoBody();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      children: const <Widget>[
        PatientHeroCard(
          title: 'Patient app offline queue',
          subtitle: 'The previous analyzer issue was caused by a provider-only screen being copied into the patient app.',
          badge: 'Resolved',
        ),
        SizedBox(height: 16),
        PatientEmptyState(
          title: 'Nothing to retry here',
          body: 'Provider offline retry management belongs to the standalone provider mobile application. This placeholder keeps the patient workspace clean when an older folder is overwritten locally.',
          icon: Icons.cloud_done_outlined,
        ),
      ],
    );
  }
}
