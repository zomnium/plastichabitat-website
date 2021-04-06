import { fromEvent, interval, merge, combineLatest, of, Observable } from 'rxjs';
import { ajax } from 'rxjs/ajax';
import { tap, scan, take, filter, startWith, map, first, debounce, debounceTime, switchMap, concatMap, mapTo, distinctUntilChanged, mergeMap, withLatestFrom, share, pluck, skipWhile, throttleTime } from 'rxjs/operators';

import { component, selector, toggleClass, addClass, removeClass, wait } from 'powrrr';

(() => {

  const body = component(element => of(element))(selector('body'));
  const layoutComponent = component(element => of(element))(selector('.layout'));
  const pageContentComponent = component(element => of(element))(selector('#content'));


  /** Navigation */

  const toggleComponent = (toggleElements, target, className) => merge(
    component(element =>
      combineLatest([
        target,
        fromEvent(element, 'click'),
      ]).pipe(
        tap(([_, event]) => event.preventDefault()),
        tap(([item, _]) => toggleClass(item, className)),
      )
    )(toggleElements)
  );

  const navigationToggle = toggleComponent(
    selector('.js-layout__toggleNavigation'),
    layoutComponent,
    '-openNavigation',
  ).subscribe();

  const searchToggle = toggleComponent(
    selector('.js-search__toggleSearch'),
    body,
    '-openSearch',
  ).subscribe();


  /** Table of Contents */

  // TODO
  // - [ ] is in view state
  // - [ ] scroll to offset
  // https://spigotdesign.com/smooth-scroll-offset-anchor-links-with-css/

  // Get headlines
  // Get offset Y (size changes)

  // Get scroll position
  // Get screenheight (size changes)

  // Combine headlines + scroll/screen + tableOfContents (is rendered)
  // See which headlines are below: screen offset Y + (screen height / 3 * 2)
  // Get last headline in array - is active headline { element, index }

  // Get active headline: distinct
  // Reset tableOfContents
  // Set active tableOfContents

  const templateTableOfContents = (items) => `
    <div class="tableOfContents">
      <ul class="tableOfContents__items">
        ${items}
      </ul>
    </div>
  `;
  const templateTableOfContentsItem = (item) => `
    <li class="tableOfContents__item">
      <a class="tableOfContents__link" href="#${item['id']}">${item['title']}</a>
    </li>
  `;

  const renderTemplate = (template, items) => items
    .map(item => template(item))
    .reduce((result, item) => result += item);


  const pageScroll = fromEvent(document, 'scroll').pipe(
    throttleTime(20),
    // tap(() => console.log('scroll')),
    share(),
  );
  const inView = () => (events) => events.pipe(
    map(element => {
      // const thing = element.getBoundingClientRect();
      // console.log('thing', thing);
      const result = !!(
        element.offsetTop >= window.pageYOffset
        && element.offsetTop <= (window.pageYOffset + window.innerHeight)
      );
      console.log('inView: result', element, result, window.innerHeight, element.offsetTop, window.pageYOffset);
      return result;
    }),
    distinctUntilChanged(),
  );

  const tableOfContentsContent = pageContentComponent.pipe(
    map(pageContent => selector(pageContent, 'h2')),
    map(headlines => Array.from(headlines)),
    map(headlines => headlines.map(headline => ({
      id: headline.getAttribute('id'),
      title: headline.textContent,
      element: headline,
    }))),
    map(headlines => renderTemplate(templateTableOfContentsItem, headlines)),
    map(headlines => templateTableOfContents(headlines)),    
  );
  const tableOfContentsTarget = component(element => of(element))(selector('.layout__tableOfContents'));
  const tableOfContentsComponent = combineLatest([tableOfContentsTarget, tableOfContentsContent])
    .subscribe(([parent, content]) => parent.innerHTML = content);

  const cardComponent = component(element =>
    pageScroll.pipe(
      mapTo(element),
      inView(),
      mapTo(element),
    )
  );

  const cardsComponent = cardComponent(selector('#content h2')).pipe(
    concatMap(wait(180)),
    tap(element => addClass(element, '-in-view')),
  ).subscribe();


  /** Search */

  const templateSearchResults = (results) => `
    <ul>${results}</ul>
  `;

  const templateSearchResult = ({title, text, permalink}) => `
    <li>
      <h3><a href="${permalink}">${title}</a></h3>
      <!-- <p>${text}</p> -->
    </li>
  `;

  const templateNoSearchResults = () => `
    <p>No results found, please try something else.</p>
  `;

  function renderSearchResults(element, results) {
    console.log('renderSearchResults', element, results);

    let output = templateNoSearchResults();

    if (results && results.hits && results.hits.length) {
      const items = results.hits
        .map(item => templateSearchResult(item))
        .reduce((result, item) => result += item);
      output = templateSearchResults(items);
    }

    console.log('renderSearchResults output', output);

    element.innerHTML = output;
  }

  function clearSearchResults(element) {
    console.log('clearSearchResults', element);
    element.innerHTML = '';
  }

  // SECOND IMPLEMENTATION

  const initialSearchState = {
    show: false,
    url: '',
    results: null,
  };

  const searchState = (state, event) => {
    console.log('searchState', state, event);
    if (event.action === 'CLEAR') {
      return initialSearchState;
    } else if (event.action === 'SEARCH') {
      return {
        show: state.show,
        url: event.data,
        results: state.results,
      }
    } else if (event.action === 'RESULTS') {
      return {
        show: true,
        url: state.url,
        results: event.data,
      }
    } else {
      return state;
    }
  }

  const searchField = selector('.js-search__field');

  const searchFieldEvents = component(element =>
    fromEvent(element, 'keyup').pipe(
      startWith(element.value),
      debounceTime(100),
      map(() => element.value),
      distinctUntilChanged(),
      map(url => !!url
        ? { action: 'SEARCH', data: `http://0.0.0.0:7700/indexes/content/search?q=${url}&attributesToHighlight=${url}` }
        : { action: 'CLEAR' }
      ),
      // tap(event => console.log('searchComponent', event)),
    )
  )(searchField);

  const searchCloseEvents = component(element =>
    fromEvent(element, 'click').pipe(
      mapTo({ action: 'CLEAR' }),
    )
  )(selector('.js-search__close'));

  const searchResults = searchFieldEvents.pipe(
    tap(event => console.log('searchResults start', event)),
    filter(event => event.action == 'SEARCH'),
    pluck('data'),
    filter(url => !!url),
    concatMap(url => ajax.getJSON(url)),
    map(data => ({ action: 'RESULTS', data })),
    tap(event => console.log('searchResults end', event)),
  );

  const effectTest = searchCloseEvents.pipe(
    mapTo({ action: 'TEST' }),
  );

  const searchStore = merge(searchFieldEvents, searchCloseEvents, searchResults, effectTest).pipe(
    startWith(initialSearchState),
    scan((state, event) => searchState(state, event)),
    tap(event => console.log('searchStore', event)),
    share(),
  );

  const searchFieldSubscription = component(element =>
    searchStore.pipe(
      pluck('show'),
      distinctUntilChanged(),
      filter(show => !show),
      tap(() => console.log('clear text field')),
      tap(() => element.value = ''),
    )
  )(searchField).subscribe();

  const searchFocus = component(element =>
    searchStore.pipe(
      pluck('show'),
      distinctUntilChanged(),
      tap((event) => console.log('focus switch', event)),
      tap(show => show
        ? addClass(element, '-openSearch')
        : removeClass(element, '-openSearch')
      ),
    )
  )(selector('body')).subscribe();

  const searchResultsComponent = component(element =>
    searchStore.pipe(
      filter(event => !!event.show),
      filter(event => !!event.results),
      tap(event => renderSearchResults(element, event.results)),
    )
  )(selector('.js-search__results')).subscribe();

  // END



  // // FIRST IMPLEMENTATION

  // const searchResultsComponent = component(element => of(element))(selector('.js-search__results'));
  // // const searchCloseComponent = component(element =>
  // //   fromEvent(element, 'click').pipe(
  // //   )
  // // )(selector('.js-search__close'));

  // const searchComponent = component(element =>
  //   fromEvent(element, 'keyup').pipe(
  //     startWith(element.value),
  //     debounceTime(100),
  //     // merge(searchResultsComponent),
  //     map(() => element.value),
  //     distinctUntilChanged(),
  //     map(event => !!event
  //       ? `http://0.0.0.0:7700/indexes/content/search?q=${event}&attributesToHighlight=${event}`
  //       : null
  //     ),
  //     tap(event => console.log('searchComponent', event)),
  //   )
  // )(selector('.js-search__field'));

  // const searchFocus = searchComponent.pipe(
  //   map(event => !!event),
  //   distinctUntilChanged(),
  //   withLatestFrom(body),
  //   tap(([show, element]) => show
  //     ? addClass(element, '-openSearch')
  //     : removeClass(element, '-openSearch')
  //   ),
  //   map(([show, _]) => show),
  //   withLatestFrom(searchResultsComponent),
  //   filter(([show, _]) => !show),
  //   debounceTime(1000),
  //   tap(([_, element]) => clearSearchResults(element)),
  // ).subscribe();

  // const searchResults = searchComponent.pipe(
  //   filter(url => !!url),
  //   concatMap(url => ajax.getJSON(url)),
  //   tap(event => console.log(event)),
  //   withLatestFrom(searchResultsComponent),
  //   tap(([results, element]) => renderSearchResults(element, results)),
  // ).subscribe();

  // // END



  // const navigationToggleComponent = component(element =>
  //   combineLatest(
  //     layoutComponent,
  //     fromEvent(element, 'click'),
  //   ).pipe(
  //     // tap(([layout, event]) => console.log('layout', layout, 'event', event)),
  //     tap(([_, event]) => event.preventDefault()),
  //     tap(([layout, _]) => toggleClass(layout, '-openNavigation')),
  //   )
  // );

  // const navigationToggleComponentInstance = navigationToggleComponent(selector('.js-layout__toggleNavigation')).subscribe();

  // const searchComponent = component(element =>
  //   fromEvent(element, 'click').pipe(
  //     tap(event => event.preventDefault()),
  //     tap(() => toggleClass(body, '-openSearch')),
  //   )
  // );

  // const searchComponentInstance = searchComponent(selector('.js-search__toggleSearch')).subscribe();

})();


// (function($){

//   var layout = $('.layout');
//   $('.js-layout__toggleNavigation')
//     .on('click', (e) => {
//       e.preventDefault();
//       console.log('toggle');
//       layout.toggleClass('-openNavigation');
//     });

//   var body = $('body');
//   $('.js-search__toggleSearch')
//     .on('click', () => {
//       console.log('toggle');
//       body.toggleClass('-openSearch');
//     });

//   // Search
//   var $searchWrap = $('#search-form-wrap'),
//     isSearchAnim = false,
//     searchAnimDuration = 200;

//   var startSearchAnim = function(){
//     isSearchAnim = true;
//   };

//   var stopSearchAnim = function(callback){
//     setTimeout(function(){
//       isSearchAnim = false;
//       callback && callback();
//     }, searchAnimDuration);
//   };

//   $('#nav-search-btn').on('click', function(){
//     if (isSearchAnim) return;

//     startSearchAnim();
//     $searchWrap.addClass('on');
//     stopSearchAnim(function(){
//       $('.search-form-input').focus();
//     });
//   });

//   $('.search-form-input').on('blur', function(){
//     startSearchAnim();
//     $searchWrap.removeClass('on');
//     stopSearchAnim();
//   });

//   // Share
//   $('body').on('click', function(){
//     $('.article-share-box.on').removeClass('on');
//   }).on('click', '.article-share-link', function(e){
//     e.stopPropagation();

//     var $this = $(this),
//       url = $this.attr('data-url'),
//       encodedUrl = encodeURIComponent(url),
//       id = 'article-share-box-' + $this.attr('data-id'),
//       offset = $this.offset();

//     if ($('#' + id).length){
//       var box = $('#' + id);

//       if (box.hasClass('on')){
//         box.removeClass('on');
//         return;
//       }
//     } else {
//       var html = [
//         '<div id="' + id + '" class="article-share-box">',
//           '<input class="article-share-input" value="' + url + '">',
//           '<div class="article-share-links">',
//             '<a href="https://twitter.com/intent/tweet?url=' + encodedUrl + '" class="article-share-twitter" target="_blank" title="Twitter"></a>',
//             '<a href="https://www.facebook.com/sharer.php?u=' + encodedUrl + '" class="article-share-facebook" target="_blank" title="Facebook"></a>',
//             '<a href="http://pinterest.com/pin/create/button/?url=' + encodedUrl + '" class="article-share-pinterest" target="_blank" title="Pinterest"></a>',
//             '<a href="https://plus.google.com/share?url=' + encodedUrl + '" class="article-share-google" target="_blank" title="Google+"></a>',
//           '</div>',
//         '</div>'
//       ].join('');

//       var box = $(html);

//       $('body').append(box);
//     }

//     $('.article-share-box.on').hide();

//     box.css({
//       top: offset.top + 25,
//       left: offset.left
//     }).addClass('on');
//   }).on('click', '.article-share-box', function(e){
//     e.stopPropagation();
//   }).on('click', '.article-share-box-input', function(){
//     $(this).select();
//   }).on('click', '.article-share-box-link', function(e){
//     e.preventDefault();
//     e.stopPropagation();

//     window.open(this.href, 'article-share-box-window-' + Date.now(), 'width=500,height=450');
//   });

//   // Caption
//   $('.article-entry').each(function(i){
//     $(this).find('img').each(function(){
//       if ($(this).parent().hasClass('fancybox')) return;

//       var alt = this.alt;

//       if (alt) $(this).after('<span class="caption">' + alt + '</span>');

//       $(this).wrap('<a href="' + this.src + '" title="' + alt + '" class="fancybox"></a>');
//     });

//     $(this).find('.fancybox').each(function(){
//       $(this).attr('rel', 'article' + i);
//     });
//   });

//   if ($.fancybox){
//     $('.fancybox').fancybox();
//   }

//   // Mobile nav
//   var $container = $('#container'),
//     isMobileNavAnim = false,
//     mobileNavAnimDuration = 200;

//   var startMobileNavAnim = function(){
//     isMobileNavAnim = true;
//   };

//   var stopMobileNavAnim = function(){
//     setTimeout(function(){
//       isMobileNavAnim = false;
//     }, mobileNavAnimDuration);
//   }

//   $('#main-nav-toggle').on('click', function(){
//     if (isMobileNavAnim) return;

//     startMobileNavAnim();
//     $container.toggleClass('mobile-nav-on');
//     stopMobileNavAnim();
//   });

//   $('#wrap').on('click', function(){
//     if (isMobileNavAnim || !$container.hasClass('mobile-nav-on')) return;

//     $container.removeClass('mobile-nav-on');
//   });
// })(jQuery);
