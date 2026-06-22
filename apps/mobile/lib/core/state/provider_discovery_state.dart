import 'package:flutter/foundation.dart';

class ProviderDiscoveryState extends ChangeNotifier {
  ProviderDiscoveryState._();

  static final ProviderDiscoveryState instance = ProviderDiscoveryState._();

  String query = 'Family';
  String serviceMode = 'Both';
  String city = 'Any';
  String sortBy = 'Earliest slot';
  bool acceptsInsurance = true;
  bool arabicSupport = true;

  bool get hasActiveFilters =>
      serviceMode != 'Both' || city != 'Any' || !acceptsInsurance || !arabicSupport || sortBy != 'Earliest slot';

  void update({
    String? query,
    String? serviceMode,
    String? city,
    String? sortBy,
    bool? acceptsInsurance,
    bool? arabicSupport,
  }) {
    this.query = query ?? this.query;
    this.serviceMode = serviceMode ?? this.serviceMode;
    this.city = city ?? this.city;
    this.sortBy = sortBy ?? this.sortBy;
    this.acceptsInsurance = acceptsInsurance ?? this.acceptsInsurance;
    this.arabicSupport = arabicSupport ?? this.arabicSupport;
    notifyListeners();
  }

  void reset() {
    query = 'Family';
    serviceMode = 'Both';
    city = 'Any';
    sortBy = 'Earliest slot';
    acceptsInsurance = true;
    arabicSupport = true;
    notifyListeners();
  }
}
