import {Component, Input} from '@angular/core';
import {components} from "../../models/product-catalog";
type Category = components["schemas"]["Category"];

@Component({
  selector: 'bae-badge',
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.css'
})
export class BadgeComponent {
  @Input() category:Category = {name:'Default'}
}
