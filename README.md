# vulog-browser-extension
vulog is an extension app that allows you to (1) bookmark web pages pages, highlight text on those pages, and take notes, (2) save your browsing history,  and (3) see the cookies tracking you on various web sites, and delete them.

Current tab
Click on the vulog button to see the main "Current" tab, and tag a page or bookmark it using these buttons:
- The 'bookmark' and 'star are buttons for regular bookmarking.
- The 'Inbox' button is for items you want to read later. You can also right click on any web link on web pages you visit and add it to your vulog inbox right from the web page.
- Links marked with 'archive' do not show in default search results when you do a search from the Marks tab.  For example, once you have read a page from your inbox,  you might want to remove the 'inbox' mark, and add it to your 'archive'.
- The 'bullfrog' button makes the link public. Note that you need a CEPS compatible server to store your data and to publish it, if you want to use this feature. (See Below)

Marks tab
In the Marks tab, you can search for items you have bookmarked.
Click on the bookmark icons to filter your results. (eg clicking on inbox turns the icon green and only shows items that have been marked 'inbox'. Clicking it again will turn the button red, and you will only see items that have NOT been marked 'inbox'. You will notice that the 'archive' mark is red by default, so that archived items do not appear in the default search results.

History tab
Search your history. The general search box searches for words used in your tags and notes and highlights, as well as meta data associated with the page.

Right Clicking on web pages
On any web page, you can right click on text you have selected to highlight it, and you can right click on a any link to add it to your inbox.

Cntrl/Cmd S on web pages
When you are on any web page, you can press cntrl-S (or cmd-S for mac) and a small menu appears on the top right corner of the web page, to allow you to bookmark it. While the menu is open, pressing cntrl/cmd-I adds to inbox,  cntrl/cmd-A archives, cntrl/cmd-B adds a bookmark, and pressing cntrl/cmd-S again adds a star. You can remove marks by clicking on them with your mouse. The Escape key gets rid of the menu, which disappears automatically after a few seconds in any case.

Data storage
Your bookmarks and browser history is kept in the chrome's local storage, which has limited space. After some weeks (or months depending on usage), vulog automatically deletes older items.

Privacy and CEPS
vulog doesn't send any of your data to any outside servers, and you can always delete your data from the "More" tab. If you want to store your data on your own server you will need to set up a Personal Data Store. vulog was built to be able to accept CEPS-compatible data stores. (See here for more details https://www.salmanff.com/ppage/2020-3-15-Why-CEPS-Matters )
Having your data sit on your personal data store also means that you can publish your bookmarks and highlights and notes. Press the bullhorn button to publish the link from your server.

Acknowledgements
Highlighting functionality was largely copied from Jérôme Parent-Lévesque. https://github.com/jeromepl/highlighter
Rendering function (dgelements.js) was inspired by David Gilbertson (who never expected someone to actually implement his idea I think.) https://medium.com/hackernoon/how-i-converted-my-react-app-to-vanillajs-and-whether-or-not-it-was-a-terrible-idea-4b14b1b2faff
