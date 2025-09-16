# Guarantee Section CSS

## Current CSS (what we have now)

```css
/* Guarantee Section */
.guarantee {
  background: linear-gradient(135deg, var(--primary-navy) 0%, #2c5aa0 100%);
  padding: var(--spacing-lg) 0;
  text-align: center;
}

.guarantee h2 {
  color: var(--white);
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-3xl);
  font-weight: 700;
}

.guarantee p {
  color: var(--white);
  font-size: var(--font-size-xl);
  opacity: 0.9;
  margin: 0;
}

@media (max-width: 768px) {
  .guarantee {
    padding: var(--spacing-2xl) 0;
  }
  
  .guarantee h2 {
    font-size: var(--font-size-xl);
  }
}
```

## HTML Structure

```html
<section class="guarantee">
    <div class="container">
        <h2>30-Day Money Back Guarantee</h2>
        <p>Not satisfied? Get a full refund within 30 days, no questions asked.</p>
    </div>
</section>
```

## Current Issues
- Styling doesn't match the reference screenshot provided
- Text size and padding not matching desired look
- Need to adjust to match the compact design shown in reference

## Notes
Please provide the correct CSS values to match your reference design.