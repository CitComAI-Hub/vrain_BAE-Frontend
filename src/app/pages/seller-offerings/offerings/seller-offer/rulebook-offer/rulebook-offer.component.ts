import { Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiServiceService } from 'src/app/services/product-service.service';
import { ProductSpecServiceService } from 'src/app/services/product-spec-service.service';
import { LocalStorageService } from 'src/app/services/local-storage.service';
import { EventMessageService } from 'src/app/services/event-message.service';
import { RulebookService } from 'src/app/services/rulebook.service';
import { LoginInfo } from 'src/app/models/interfaces';

/**
 * New offer from a rulebook class (CitCom data space).
 *
 * The provider chooses a class and fills a few fields; the rulebook service, through
 * the proxy, generates the access policies and the terms. Nothing generated can be
 * edited here, and the proxy checks every write again, so an offer is always what
 * its class allows. Publishing creates and launches the specification and the
 * offering through the normal catalog API, and updates the verifier policy of the
 * provider's earlier offers when the new one adds a role.
 */
@Component({
  selector: 'rulebook-offer',
  templateUrl: './rulebook-offer.component.html',
  styleUrl: './rulebook-offer.component.css'
})
export class RulebookOfferComponent implements OnInit {
  loading = true;
  notAvailable = '';
  classes: any[] = [];
  selected: any = null;

  org: any = null;
  catalogs: any[] = [];
  categories: any[] = [];

  form = {
    title: '',
    description: '',
    name: '',
    path: '',
    entity_type: '',
    role: '',
    image: '',
    catalog: '',
    categories: [] as string[],
  };
  nameEdited = false;
  roleEdited = false;
  terms: Record<string, string> = {};

  generated: any = null;
  error = '';
  publishing = false;
  progress: string[] = [];

  constructor(
    private rulebook: RulebookService,
    private api: ApiServiceService,
    private specs: ProductSpecServiceService,
    private localStorage: LocalStorageService,
    private eventMessage: EventMessageService
  ) {}

  async ngOnInit() {
    const login = this.localStorage.getObject('login_items') as LoginInfo;
    this.org = login?.organizations?.find((o: any) => o.id === login.logged_as);
    if (!this.org) {
      this.notAvailable = 'Act on behalf of your organisation to publish offers (switch organisation in the user menu).';
      this.loading = false;
      return;
    }
    try {
      const [classes, catalogs, categories] = await Promise.all([
        this.rulebook.classes(),
        this.api.getCatalogsByUser(0, undefined, ['Active', 'Launched'], this.org.partyId),
        this.api.getLaunchedCategories(),
      ]);
      this.classes = classes;
      this.catalogs = catalogs || [];
      const catalogCategories = new Set(
        this.catalogs.flatMap((c: any) => (Array.isArray(c.category) ? c.category : [c.category]).filter(Boolean).map((x: any) => x.id))
      );
      this.categories = (categories || []).filter((c: any) => !catalogCategories.has(c.id));
      if (this.catalogs.length === 1) {
        this.form.catalog = this.catalogs[0].id;
      }
    } catch (e: any) {
      this.notAvailable = e?.status === 403
        ? (e.error?.error || 'Your organisation cannot publish offers yet. Ask the data space operator.')
        : 'The rulebook service is not available. Try again later.';
    }
    this.loading = false;
  }

  private remembered(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(`rulebook_terms_${this.org.id}`) || '{}');
    } catch {
      return {};
    }
  }

  private remember() {
    const provider: Record<string, string> = {};
    for (const f of this.selected.terms_fields) {
      if (f.scope === 'provider' && this.terms[f.name]) {
        provider[f.name] = this.terms[f.name];
      }
    }
    try {
      localStorage.setItem(`rulebook_terms_${this.org.id}`, JSON.stringify({ ...this.remembered(), ...provider }));
    } catch {
      // private window: nothing to remember
    }
  }

  choose(cls: any) {
    this.selected = cls;
    this.generated = null;
    this.error = '';
    const saved = this.remembered();
    this.terms = {};
    for (const f of cls.terms_fields) {
      this.terms[f.name] = f.scope === 'provider' ? (saved[f.name] || '') : '';
    }
    if (!this.terms['provider_name'] && this.org?.name && !this.org.name.startsWith('did:')) {
      this.terms['provider_name'] = this.org.name;
    }
  }

  // Offer fields first, then the organisation's (remembered); optional ones last.
  termsGroup(scope: string): any[] {
    if (!this.selected) return [];
    return this.selected.terms_fields
      .filter((f: any) => f.scope === scope)
      .sort((a: any, b: any) =>
        Number(a.optional) - Number(b.optional) ||
        Number(b.name === 'provider_name') - Number(a.name === 'provider_name'));
  }

  asks(field: string): boolean {
    return !!this.selected && this.selected.fields.some((f: any) => f.name === field);
  }

  help(field: string): string {
    return this.selected?.fields.find((f: any) => f.name === field)?.description || '';
  }

  onTitle() {
    if (!this.nameEdited) {
      this.form.name = this.form.title
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
      this.onName();
    }
  }

  onName() {
    if (!this.roleEdited && this.selected && !this.selected.role) {
      this.form.role = this.form.name ? `${this.form.name.replace(/-/g, '_')}_user` : '';
    }
    if (this.selected && !this.selected.role && !this.form.path && this.form.name) {
      this.form.path = `/${this.form.name}`;
    }
    this.generated = null;
  }

  toggleCategory(id: string, on: boolean) {
    this.form.categories = on ? [...this.form.categories, id] : this.form.categories.filter((c) => c !== id);
  }

  // The required fields still empty, in the order of the form.
  missing(): string[] {
    if (!this.selected) return [];
    const f = this.form;
    const out: string[] = [];
    if (!f.title.trim()) out.push('Title');
    if (!f.name.trim()) out.push('Short name');
    if (!f.path.trim()) out.push('Path in your gateway');
    if (this.asks('entity_type') && !f.entity_type.trim()) out.push('Entity type');
    if (this.asks('role') && !f.role.trim()) out.push('Role of its users');
    if (!f.catalog) out.push('Catalogue');
    for (const scope of ['offer', 'provider']) {
      for (const t of this.termsGroup(scope)) {
        if (!t.optional && !(this.terms[t.name] || '').trim()) out.push(t.description);
      }
    }
    return out;
  }

  ready(): boolean {
    return !!this.selected && this.missing().length === 0;
  }

  private request() {
    const offer: any = { name: this.form.name, path: this.form.path, terms: {} };
    if (this.asks('entity_type')) offer.entity_type = this.form.entity_type;
    if (this.asks('role')) offer.role = this.form.role;
    const provider_terms: Record<string, string> = {};
    for (const f of this.selected.terms_fields) {
      const value = (this.terms[f.name] || '').trim();
      if (f.scope === 'provider') provider_terms[f.name] = value;
      else offer.terms[f.name] = value;
    }
    return { class: this.selected.id, offer, provider_terms };
  }

  async preview() {
    this.error = '';
    this.generated = null;
    try {
      this.generated = await this.rulebook.generate(this.request());
      this.remember();
    } catch (e: any) {
      this.error = e?.error?.error || 'The offer could not be generated. Try again later.';
    }
  }

  // A plain-words summary of what the generated policy grants.
  summary(): string[] {
    if (!this.selected) return [];
    const limit = this.generated?.rate_limit || this.selected.rate_limit;
    const per = `${limit.count} requests every ${limit.time_window} s per buying organisation`;
    if (this.selected.credential === 'MachineCredential') {
      return [
        `The software of each buying organisation can read the ${this.form.entity_type} entities under ${this.form.path} of your connector. Read only.`,
        `It needs the data access role (${this.selected.role}), which the buyer gives to its software.`,
        `Request limit: ${per}.`,
      ];
    }
    return [
      `The people of each buying organisation that hold the role ${this.form.role} can use everything under ${this.form.path} of your connector.`,
      `Request limit: ${per}.`,
    ];
  }

  async publish() {
    if (!this.generated) return;
    this.publishing = true;
    this.error = '';
    this.progress = [];
    const seller = [{ id: this.org.partyId, href: this.org.partyId, name: this.org.id, role: environment.SELLER_ROLE, '@referredType': 'Organization' }];
    try {
      const spec: any = {
        name: this.form.title.trim(),
        description: this.form.description,
        brand: this.terms['provider_name'] || this.org.name,
        version: '0.1',
        lifecycleStatus: 'Active',
        isBundle: false,
        productSpecCharacteristic: this.generated.characteristics,
        relatedParty: seller,
      };
      if (this.form.image.trim()) {
        spec.attachment = [{ name: 'Profile Picture', url: this.form.image.trim(), attachmentType: 'Picture' }];
      }
      const createdSpec = await lastValueFrom(this.specs.postProdSpec(spec));
      await lastValueFrom(this.specs.updateProdSpec({ lifecycleStatus: 'Launched' }, createdSpec.id));
      this.progress.push('Specification published');

      const categories = this.categories
        .filter((c) => this.form.categories.includes(c.id))
        .map((c) => ({ id: c.id, href: c.id, name: c.name }));
      const offering: any = {
        name: this.form.title.trim(),
        description: this.form.description,
        lifecycleStatus: 'Active',
        isBundle: false,
        version: '0.1',
        category: categories,
        productOfferingPrice: [],
        validFor: { startDateTime: new Date().toISOString() },
        productSpecification: { id: createdSpec.id, href: createdSpec.id },
        productOfferingTerm: [
          { name: 'procurement', description: 'manual' },
          { name: 'License', description: this.generated.terms['License'] },
          { name: 'Policy class', description: this.generated.terms['Policy class'] },
        ],
      };
      const createdOffer = await lastValueFrom(this.api.postProductOffering(offering, this.form.catalog));
      await lastValueFrom(this.api.updateProductOffering({ lifecycleStatus: 'Launched' }, createdOffer.id));
      this.progress.push('Offer published');

      for (const update of this.generated.sibling_updates || []) {
        const current: any = await this.api.getProductSpecification(update.id);
        const chars = (current.productSpecCharacteristic || []).map((c: any) =>
          c.name === update.characteristic.name ? update.characteristic : c
        );
        await lastValueFrom(this.specs.updateProdSpec({ productSpecCharacteristic: chars }, update.id));
        this.progress.push(`Updated the roles of "${current.name}"`);
      }
      this.remember();
      this.eventMessage.emitSellerOffer(true);
    } catch (e: any) {
      this.error = e?.error?.error || e?.error?.message || 'The offer could not be published.';
      if (this.progress.length) {
        this.error += ` Done so far: ${this.progress.join(', ')}. Check "My offerings" before trying again.`;
      }
    }
    this.publishing = false;
  }

  goBack() {
    this.eventMessage.emitSellerOffer(true);
  }
}
