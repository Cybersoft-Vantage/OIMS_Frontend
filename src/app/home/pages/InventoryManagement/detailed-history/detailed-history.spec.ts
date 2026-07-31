import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetailedHistory } from './detailed-history';

describe('DetailedHistory', () => {
  let component: DetailedHistory;
  let fixture: ComponentFixture<DetailedHistory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailedHistory]
    }).compileComponents();

    fixture = TestBed.createComponent(DetailedHistory);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
