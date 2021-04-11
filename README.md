# vulog-browser-extension
vulog is an extension app that allows you to (1) bookmark web pages pages, highlight text on those pages, and take notes, (2) save your browsing history,  and (3) see the cookies tracking you on various web sites, and delete them.

Interacting with vulog
- The pop-up - Press the vulog button at the top of your browser and the vulog pop-up appears. So you can bookmark the page you are on, take notes and view your inbox. You can also click on a link to view your bookmarks in a browser tab, and choose your highlighting color and edit mode.
- Browser tab: View and search your bookmarks, or filter to see what you have bookmarked. (Use link under the inbox tab.)
- The webpage-box: Press CNTRL S (Mac: CMD S)  on any web page and you will see a small box on the top right of the page where you can bookmark and take notes, and also change your highlighting options and edit mode. (see below) Press escape to close the web-page box.
- Right-Click: When you highlight text, you can right click on it to highlight the text. If you right click on a web page link, you also have a choice to add it to your inbox for later reading.
- 'Edit Mode': If you turn on edit mode (from the pop-up or webpage-box), then your cursor will turn into a giant highlighter and you can highlight text. When you press on a link in edit mode, you get the option of adding it to you inbox (which means you dont have to go through the right-click menu)

Highlighting text: You can highlight parts of any web page in different colors. Use the highlight pallette in the pop-up or webpage-box to choose your highlight color. For easier highlighting, turn on edit mode.

Bookmarking: You can add any page to your favorites, inbox or archive using the pop-up or webpage-box. The 'inbox' tab in your pop-up automatically shows all the items marked with inbox, and not marked with archive. From there you can also see all your bookmarks in a browser tab. Also, while the menu is open, pressing cntrl/cmd-I adds to inbox,  cntrl/cmd-A archives, and pressing cntrl/cmd-S again adds it to favorites.

Web Page Info: The pop-up shows detailed info on the web pages you visit. You can see the cookies and third party trackers that a site is using, and you can delete all the trackers that vulog has found. (Web pages have many ways of tracking you, so dont think this is a magic bullet.)

Data storage: Your bookmarks and browser history is kept in the chrome's local storage, which has limited space. After some weeks (or months depending on usage), vulog automatically deletes older items.

Privacy and CEPS
vulog doesn't send any of your data to any outside servers, and you can always delete your data from the "Settings" tab. If you want to store your data on your own server you will need to set up a Personal Data Store. vulog was built to be able to accept CEPS-compatible data stores. (See here for more details https://www.salmanff.com/ppage/2020-3-15-Why-CEPS-Matters )
Having your data sit on your personal data store also means that you can publish your bookmarks and highlights and notes. (More on this in later versions)

Acknowledgements
Highlighting functionality was largely copied from Jérôme Parent-Lévesque. https://github.com/jeromepl/highlighter
Rendering function (dgelements.js) was inspired by David Gilbertson (who never expected someone to actually implement his idea I think.) https://medium.com/hackernoon/how-i-converted-my-react-app-to-vanillajs-and-whether-or-not-it-was-a-terrible-idea-4b14b1b2faff
