(async()=> {

    const sentinel=document.querySelector(".refresh-sentinel");

    const grid=document.getElementById("feed-grid");
    if(!sentinel|| !grid)
        return;
    let hasMore= sentinel.dataset.hasMore==='true';
    let nextSkip=Number(sentinel.dataset.nextSkip);

    
    const seen=new Set([...document.querySelectorAll('.feed [data-id]')].map(obj=>obj.dataset.id));

    console.log(seen);

    const fetchBatch = async (skip=0)=>{


        const params=new URLSearchParams(location.search);
        console.log(params);
        const response= await fetch('/api/feed?'+params);
        if(!response.ok)
            throw new Error('cant fetch new data');
        return response.json();
    };

    console.log(await fetchBatch(20));

    const renderCards=async (cards={})=>{
        
    };

})();

